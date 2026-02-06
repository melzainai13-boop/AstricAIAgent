
import React, { useState } from 'react';
import { Lock, User } from 'lucide-react';

interface AdminLoginProps {
  onLogin: (success: boolean) => void;
}

const AdminLogin: React.FC<AdminLoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const storedCreds = JSON.parse(localStorage.getItem('admin_creds') || '{"u":"admin","p":"admin"}');
    
    if (username === storedCreds.u && password === storedCreds.p) {
      onLogin(true);
    } else {
      setError('خطأ في اسم المستخدم أو كلمة المرور');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black/90 p-4">
      <div className="bg-[#111] border border-green-900/30 p-8 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center border border-green-500/30">
            <Lock className="text-green-500 w-8 h-8" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-center mb-6 text-white">لوحة تحكم استرك</h2>
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="relative">
            <User className="absolute right-3 top-3 w-5 h-5 text-gray-500" />
            <input 
              type="text" 
              placeholder="اسم المستخدم"
              className="w-full bg-black border border-gray-800 rounded-xl py-2.5 pr-10 pl-4 focus:outline-none focus:border-green-500 transition-colors text-white"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="relative">
            <Lock className="absolute right-3 top-3 w-5 h-5 text-gray-500" />
            <input 
              type="password" 
              placeholder="كلمة المرور"
              className="w-full bg-black border border-gray-800 rounded-xl py-2.5 pr-10 pl-4 focus:outline-none focus:border-green-500 transition-colors text-white"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <button 
            type="submit"
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 rounded-xl transition-all shadow-lg shadow-green-900/20"
          >
            دخول
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminLogin;
