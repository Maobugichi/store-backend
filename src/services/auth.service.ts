import bcryptyjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto'

const SALT_ROUNDS = 10;

export const env = {
  JWT_SECRET: process.env.JWT_SECRET ?? (() => {
    throw new Error('JWT_SECRET missing');
  })(),
};


export const hashPassword = async (password:string):Promise<string> => {
   return await bcryptyjs.hash(password,SALT_ROUNDS);
}

export const comparePassword = async (
    password:string,
    hash:string
):Promise<boolean> => {
    return await bcryptyjs.compare(password, hash);
}


export const generateToken = (adminId:number):string => {
    return jwt.sign({ adminId }, env.JWT_SECRET, { expiresIn:'7d' })
}


export const verifyToken = (token:string):{  adminId:number } | null => {
     try {
        return jwt.verify(token,env.JWT_SECRET) as { adminId: number }
     } catch {
        return null
     }
}

export const generateInviteCode = ():string => {
    return crypto.randomBytes(16).toString('hex');
}