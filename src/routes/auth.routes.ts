import { Router , Request, Response } from "express";
import pool from "../config/db.js";
import { 
    hashPassword,
    comparePassword,
    generateToken,
    generateInviteCode
} from '../services/auth.service.js';
import { AuthRequest, requireAuth } from "../middleware/auth.middleware.js";
import { loginSchema, registerSchema } from "../config/zod.config.js";
import { authLimiter } from "../services/limiter.service.js";
import z from "zod";
import logger from "../services/logger.service.js";

const router = Router();

router.post('/register', authLimiter, async (req:Request,res:Response):Promise<void> => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN')
        const validated = registerSchema.parse(req.body);

        const { username, password, email , inviteCode } = validated

        const codeResult = await client.query(
            `SELECT id, used, expires_at FROM admin_invite_codes WHERE code = $1`,
            [inviteCode]
        );

        if (codeResult.rows.length === 0) {
            res.status(401).json({ error: 'Invalid invite code' });
            return;
        }

        const invite = codeResult.rows[0];

        if (invite.used) {
            res.status(401).json({ error: 'Invite code has already been used'});
            return;
        }

        if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
            res.status(401).json({ error: 'Invite code has expired' });
            return;
        }

        const existing = await client.query(
            `SELECT id FROM admins WHERE username = $1 OR email = $2`,
            [username, email]
        )

        if (existing.rows.length > 0) {
            res.status(409).json({ error: 'Username or email already exists'});
            return;
        }

        const passwordHash = await hashPassword(password);

        const result = await client.query(
            `INSERT INTO admins (username, email, password_hash)
             VALUES($1, $2, $3)
             RETURNING id, username, email, created_at
            `,
            [username, email, passwordHash]
        );

        const admin = result.rows[0];

        await client.query(
            `UPDATE admin_invite_codes
             SET used = TRUE , used_by = $1, used_at = CURRENT_TIMESTAMP
             WHERE id = $2
            `,
            [admin.id, invite.id]
        );

        const token =  generateToken(admin.id);
        await client.query('COMMIT');
        res.status(201).json({
            message:'Admin account created successfully',
            admin: {
                id: admin.id,
                username:admin.username,
                email:admin.email,
                createdAt:admin.created_at
            },
            token
        });
       
    } catch(error) {
        await client.query('ROLLBACK');
        logger.error('Registration error:', { error, body: req.body?.username }); 
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: 'Invalid input' });
            return;
        }
        res.status(500).json({ error: 'Registration failed'})
    } finally {
        client.release();
    }
});


router.post('/login' , authLimiter, async (req:Request, res:Response):Promise<void> => {
     const client = await pool.connect();
     try {
        await client.query('BEGIN')
        const validate = loginSchema.parse(req.body);

        const { username, password } = validate;
        const result = await client.query(
            `SELECT id, username, email, password_hash, created_at, 
                    failed_attempts, locked_until 
            FROM admins 
            WHERE username = $1`,
            [username]
        );

        const admin = result.rows[0];

        if (admin?.locked_until && new Date(admin?.locked_until) > new Date()) {
            await client.query('ROLLBACK');
            res.status(423).json({ 
                error: 'Account temporarily locked due to multiple failed login attempts. Please try again later.' 
            });
            return;
        }

        const hashToCompare = admin?.password_hash || 
         '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';


        const isValid = await comparePassword(password,hashToCompare);

        if (!admin || !isValid) {
            if (admin) {
                const newFailedAttempt = (admin.failed_attempts || 0) + 1;
                const shouldLock = newFailedAttempt >= 5

                await client.query(
                    `UPDATE admins 
                    SET failed_attempts = $1,
                        locked_until = CASE 
                            WHEN $2 THEN CURRENT_TIMESTAMP + INTERVAL '30 minutes'
                            ELSE locked_until 
                        END
                    WHERE id = $3`,
                    [newFailedAttempt, shouldLock, admin.id]
                );
                
                await client.query('COMMIT');
            } else {
               await client.query('ROLLBACK')
           }

           res.status(401).json({ error: 'Invalid Credentials'});
            return;
        } 
       
        await client.query(
            `UPDATE admins 
            SET failed_attempts = 0, 
                locked_until = NULL 
            WHERE id = $1`,
            [admin.id]
        );

        const token = generateToken(admin.id);
        await client.query('COMMIT')
        res.json({
            message:'Login successful',
            admin: {
                id:admin.id,
                username:admin.username,
                email:admin.email,
                createdAt:admin.created_at
            },
            token
        });

     } catch(error) {
        await client.query('ROLLBACK')
        logger.error('Login error:', { error, username: req.body?.username });
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: 'Invalid input' });
            return;
        }
        res.status(500).json({ error: 'Login failure'})
     } finally {
         client.release();
     }
});


router.get('/me', requireAuth, async (req:AuthRequest, res:Response) => {
    try {
        const result = await pool.query(
            `SELECT id, username , email, created_at FROM admins WHERE id = $1`,
            [req.adminId]
        );

        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Admin not found'});
            return
        }

        res.json({ admin: result.rows[0] })
    } catch(error) {
        logger.error('Get admin error:', { error, adminId: req.adminId });
        res.status(500).json({ error: 'Failed to get admin information'});
    }
});


router.post('/generate-invite' , requireAuth, async (req:AuthRequest, res:Response) => {
    
    try {
        const { expiresInDays = 7 } = req.body;

        if (typeof expiresInDays !== 'number' || 
            expiresInDays < 1 || 
            expiresInDays > 365) {
            res.status(400).json({ error: 'expiresInDays must be between 1 and 365' });
            return;
        }

        const code = generateInviteCode();
  
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expiresInDays);

        const result = await pool.query(
            `INSERT INTO admin_invite_codes (code, created_by, expires_at)
             VALUES($1, $2, $3)
             RETURNING id , code, expires_at, created_at
            `,
            [code, req.adminId, expiresAt]
        );

        const inviteCode = result.rows[0];

        res.status(201).json({
            message: 'Invite code generated successfully',
            inviteCode: {
                id: inviteCode.id,
                code: inviteCode.code,
                expiresAt: inviteCode.expires_at,
                createdAt: inviteCode.created_at,
            },
        });
    } catch(error) {
        logger.error('Generate invite error:', { error, adminId: req.adminId });
        res.status(500).json({ error: 'Failed to generate invite code' });
    }
});

router.get('/invites', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { showUsed = 'false' } = req.query;

    const result = await pool.query(
        `SELECT 
            ic.id, ic.code, ic.used, ic.expires_at, ic.created_at, ic.used_at,
            creator.username as created_by_username,
            user_admin.username as used_by_username
        FROM admin_invite_codes ic
        LEFT JOIN admins creator ON ic.created_by = creator.id
        LEFT JOIN admins user_admin ON ic.used_by = user_admin.id
        WHERE ($1::boolean IS NULL OR ic.used = $1)
        ORDER BY ic.created_at DESC`,
        [showUsed === 'false' ? false : null]
    );

    res.json({
      inviteCodes: result.rows.map(code => ({
        id: code.id,
        code: code.code,
        used: code.used,
        expiresAt: code.expires_at,
        createdAt: code.created_at,
        usedAt: code.used_at,
        createdBy: code.created_by_username,
        usedBy: code.used_by_username,
      })),
    });
  } catch (error) {
    logger.error('Get invites error:', { error, adminId: req.adminId });
    res.status(500).json({ error: 'Failed to fetch invite codes' });
  }
});


router.delete('/invites/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM admin_invite_codes WHERE id = $1 AND used = FALSE RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Invite code not found or already used' });
      return;
    }

    res.json({ message: 'Invite code revoked successfully' });
  } catch (error) {
    logger.error('Delete invite error:', { error, inviteId: req.params.id, adminId: req.adminId });
    res.status(500).json({ error: 'Failed to revoke invite code' });
  }
});

export default router;