import {openDatabase} from '../server/db.mjs';
const email=process.argv[2]?.trim().toLowerCase();
if(!email || !email.includes('@'))throw new Error('Usage: node --env-file=.env scripts/grant-admin.mjs EMAIL');
const db=await openDatabase();
try {
 const user=await db.prepare('SELECT id FROM users WHERE email=?').get(email);
 if(!user)throw new Error('Create the Swipe account first; no pending email grants are stored.');
 await db.prepare('INSERT INTO admin_roles(user_id) VALUES (?) ON CONFLICT DO NOTHING').run(user.id);
 console.log('Administrator role assigned to the existing account.');
}finally{await db.close();}
