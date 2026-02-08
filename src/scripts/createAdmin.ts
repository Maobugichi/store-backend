import pool from '../config/db.js';
import { hashPassword, generateInviteCode } from '../services/auth.service.js';
import dotenv from 'dotenv';
import readline from 'readline'

dotenv.config();

async function createFirstAdmin() {
  try {
    console.log('Creating first admin account...\n');

    
    const existingAdmins = await pool.query('SELECT COUNT(*) FROM admins');
    const adminCount = parseInt(existingAdmins.rows[0].count);

    if (adminCount > 0) {
      console.log('Admins already exist in the database!');
      console.log(`   Found ${adminCount} admin(s).\n`);
      
    
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const answer = await new Promise<string>((resolve) => {
        rl.question('Do you want to create another admin anyway? (yes/no): ', resolve);
      });
      
      rl.close();

      if (answer.toLowerCase() !== 'yes') {
        console.log('Cancelled.');
        await pool.end();
        process.exit(0);
      }
    }

    
    const username = process.env.FIRST_ADMIN_USERNAME || 'superadmin';
    const email = process.env.FIRST_ADMIN_EMAIL || 'admin@example.com';
    const password = process.env.FIRST_ADMIN_PASSWORD || 'ChangeMe123!';

    console.log('Creating admin with:');
    console.log(`  Username: ${username}`);
    console.log(`  Email: ${email}`);
    console.log(`  Password: ${password}\n`);

   
    const passwordHash = await hashPassword(password);

    
    const result = await pool.query(
      `INSERT INTO admins (username, email, password_hash) 
       VALUES ($1, $2, $3) 
       RETURNING id, username, email, created_at`,
      [username, email, passwordHash]
    );

    const admin = result.rows[0];

    console.log(' First admin created successfully!\n');
    console.log('Admin Details:');
    console.log(`  ID: ${admin.id}`);
    console.log(`  Username: ${admin.username}`);
    console.log(`  Email: ${admin.email}`);
    console.log(`  Created: ${admin.created_at}\n`);

    // Generate first invite code
    const inviteCode = generateInviteCode();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

    await pool.query(
      `INSERT INTO admin_invite_codes (code, created_by, expires_at) 
       VALUES ($1, $2, $3)`,
      [inviteCode, admin.id, expiresAt]
    );

    console.log('🎟️  First invite code generated:');
    console.log(`  Code: ${inviteCode}`);
    console.log(`  Expires: ${expiresAt.toISOString()}\n`);

    console.log('⚠️  IMPORTANT: Change the default password after first login!');
    console.log('💡 Use this invite code to create additional admin accounts.\n');

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating first admin:', error);
    await pool.end();
    process.exit(1);
  }
}

createFirstAdmin();