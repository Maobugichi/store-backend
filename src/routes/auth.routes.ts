import { Router , Request, Response } from "express";
import pool from "../config/db.js";
import { 
    hashPassword,
    comparePassword,
    generateToken,
    generateInviteCode
} from '../services/auth.service.js';
import { AuthRequest, requireAuth } from "../middleware/auth.middleware";
import { registerSchema } from "../config/zod.config";

const router = Router();

router.post('/register', async (req:Request,res:Response):Promise<void> => {
    try {
        const validated = registerSchema.parse(req.body);

        const { username, password, email , inviteCode } = validated

        const codeResult = await pool.query(
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

        const existing = await pool.query(
            `SELECT id FROM admins WHERE username = $1 OR email = $2`,
            [username, email]
        )

        if (existing.rows.length > 0) {
            res.status(409).json({ error: 'Username or email already exists'});
            return;
        }

        const passwordHash = await hashPassword(password);

        const result = await pool.query(
            `INSERT INTO admins (username, email, password_hash)
             VALUES($1, $2, $3)
             RETURNING id, username, email, created_at
            `,
            [username, email, passwordHash]
        );

        const admin = result.rows[0];

        await pool.query(
            `UPDATE admin_invite_codes
             SET used = TRUE , used_by = $1, used_at = CURRENT_TIMESTAMP
             WHERE id = $2
            `,
            [admin.id, invite.id]
        );

        const token =  generateToken(admin.id);

        res.status(201).json({
            message:'Admin account created successfully',
            admin: {
                id: admin.id,
                username:admin.username,
                email:admin.email,
                createdAt:admin.created_at
            },
            token
        })
    } catch(error) {
        console.error('Registration error', error);
        res.status(500).json({ error: 'Registration failed'})
    }
});


router.post('/login' , async (req:Request, res:Response) => {
     try {
        const validate = registerSchema.parse(req.body);

        const { username, password } = req.body;

        const result = await pool.query(
            `SELECT id, username, email, password_hash, created_at FROM admins WHERE username = $1`,
            [username]
        );

        if (result.rows.length === 0) {
            res.status(401).json({ error: 'Invalid Credentials'});
            return;
        }

        const admin = result.rows[0];

        const isValid = await comparePassword(password,admin.password_hash);

        if (!isValid) {
            res.status(401).json({ error: 'Invalid credentials'});
            return;
        }

        const token = generateToken(admin.id);

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
        console.error('Login error', error);
        res.status(500).json({ error: 'Login failure'})
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
        }

        res.json({ admin: result.rows[0] })
    } catch(error) {
        console.error('Get admin error', error);
        res.status(500).json({ error: 'Failed to get admin information'});
    }
});


router.post('/generate-invite' , requireAuth, async (req:AuthRequest, res:Response) => {
    try {
        const { expiresInDays = 7 } = req.body;

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
        console.error('Generate invite error:', error);
        res.status(500).json({ error: 'Failed to generate invite code' });
    }
});

router.get('/invites', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { showUsed = 'false' } = req.query;

    let query = `
      SELECT 
        ic.id,
        ic.code,
        ic.used,
        ic.expires_at,
        ic.created_at,
        ic.used_at,
        creator.username as created_by_username,
        user_admin.username as used_by_username
      FROM admin_invite_codes ic
      LEFT JOIN admins creator ON ic.created_by = creator.id
      LEFT JOIN admins user_admin ON ic.used_by = user_admin.id
    `;

    if (showUsed === 'false') {
      query += ' WHERE ic.used = FALSE';
    }

    query += ' ORDER BY ic.created_at DESC';

    const result = await pool.query(query);

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
    console.error('Get invites error:', error);
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
    console.error('Delete invite error:', error);
    res.status(500).json({ error: 'Failed to revoke invite code' });
  }
});

export default router;