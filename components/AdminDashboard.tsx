
import React, { useState, useEffect } from 'react';
import { CustomerProfile, AdminSettings, Order } from '../types';
import { Users, FileText, Settings, Download, Trash2, LogOut, Save, Star } from 'lucide-react';

const AdminDashboard: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [activeTab, setActiveTab] = useState<'crm' | 'knowledge' | 'settings'>('crm');
  const [settings, setSettings] = useState<AdminSettings>({
    adminUsername: 'admin',
    adminPasswordHash: 'admin',
    storeUrl: 'https://dandrugs.store',
    phoneNumbers: ['+249129275144'],
    instantInstructions: ''
  });

  useEffect(() => {
    const savedCustomers = localStorage.getItem('astric_customers');
    if (savedCustomers) setCustomers(JSON.parse(savedCustomers));
    const savedSettings = localStorage.getItem('astric_settings');
    if (savedSettings) setSettings(JSON.parse(savedSettings));
  }, []);

  const saveSettings = () => {
    localStorage.setItem('astric_settings', JSON.stringify(settings));
    localStorage.setItem('admin_creds', JSON.stringify({u: settings.adminUsername, p: settings.adminPasswordHash}));
    alert('تم حفظ الإعدادات بنجاح');
  };

  const deleteCustomer = (id: string) => {
    if(!confirm("هل أنت متأكد من حذف هذا العميل؟")) return;
    const updated = customers.filter(c => c.id !== id);
    setCustomers(updated);
    localStorage.setItem('astric_customers', JSON.stringify(updated));
  };

  const exportPDF = (customer: CustomerProfile, order: Order) => {
    const printContent = `
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Job Order - Astric</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo&display=swap');
            body { font-family: 'Cairo', sans-serif; direction: rtl; padding: 40px; color: #333; }
            header { text-align: center; border-bottom: 3px solid #22c55e; padding-bottom: 20px; margin-bottom: 30px; }
            .order-id { color: #22c55e; font-weight: bold; }
            .section { margin-bottom: 15px; border-right: 4px solid #eee; padding-right: 15px; }
            .label { font-weight: bold; color: #666; display: block; font-size: 0.9em; }
            .value { font-size: 1.1em; }
            .details { background: #f9f9f9; padding: 20px; border-radius: 10px; margin-top: 20px; }
            footer { margin-top: 50px; font-size: 0.8em; text-align: center; color: #999; }
          </style>
        </head>
        <body>
          <header>
            <h1>استرك للحلول التقنية - أمر شغل</h1>
            <p>سجل تجاري: 144058 | Astric.sd</p>
          </header>
          <div class="section"><span class="label">العميل</span><span class="value">${customer.name}</span></div>
          <div class="section"><span class="label">رقم الهاتف</span><span class="value">${customer.phone}</span></div>
          <div class="section"><span class="label">العنوان</span><span class="value">${customer.address}</span></div>
          <div class="section"><span class="label">النشاط</span><span class="value">${customer.activityType}</span></div>
          <div class="details">
            <h3 style="margin-top:0">تفاصيل الخدمة المطلوبة:</h3>
            <p><strong>الخدمة:</strong> ${order.service}</p>
            <p>${order.details}</p>
          </div>
          <p style="text-align:left; margin-top:20px;">التاريخ: ${new Date(order.timestamp).toLocaleDateString('ar-SA')}</p>
          <footer>جميع الحقوق محفوظة لشركة استرك © 2024</footer>
        </body>
      </html>
    `;
    const win = window.open('', '_blank');
    win?.document.write(printContent);
    win?.document.close();
    win?.print();
  };

  return (
    <div className="min-h-screen bg-black text-gray-200 flex flex-col md:flex-row">
      <div className="w-full md:w-64 bg-[#0a0a0a] border-l border-gray-800 p-6 flex flex-col gap-2">
        <h1 className="text-xl font-bold text-green-500 mb-8 flex items-center gap-2">لوحة التحكم</h1>
        <button onClick={() => setActiveTab('crm')} className={`flex items-center gap-3 p-3 rounded-xl ${activeTab === 'crm' ? 'bg-green-500/10 text-green-500' : 'hover:bg-gray-800'}`}><Users className="w-5 h-5" /> العملاء والطلبات</button>
        <button onClick={() => setActiveTab('knowledge')} className={`flex items-center gap-3 p-3 rounded-xl ${activeTab === 'knowledge' ? 'bg-green-500/10 text-green-500' : 'hover:bg-gray-800'}`}><FileText className="w-5 h-5" /> إدارة المعرفة</button>
        <button onClick={() => setActiveTab('settings')} className={`flex items-center gap-3 p-3 rounded-xl ${activeTab === 'settings' ? 'bg-green-500/10 text-green-500' : 'hover:bg-gray-800'}`}><Settings className="w-5 h-5" /> الإعدادات</button>
        <div className="mt-auto pt-8 border-t border-gray-800"><button onClick={onLogout} className="flex items-center gap-3 p-3 rounded-xl hover:bg-red-500/10 text-red-500 w-full"><LogOut className="w-5 h-5" /> خروج</button></div>
      </div>

      <div className="flex-1 p-8 overflow-auto">
        {activeTab === 'crm' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">طلبات العملاء</h2>
            <div className="grid grid-cols-1 gap-4">
              {customers.map(c => (
                <div key={c.id} className="bg-[#111] border border-gray-800 rounded-2xl p-6 hover:border-green-500/20">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                         <h3 className="text-xl font-bold text-white">{c.name}</h3>
                         {c.orders.length > 1 && <span className="bg-green-500/20 text-green-500 text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1"><Star className="w-3 h-3" /> عميل سابق</span>}
                      </div>
                      <p className="text-sm text-gray-500">{c.phone} | {c.address}</p>
                      <p className="text-xs text-green-600 mt-1 font-mono">{c.activityType}</p>
                    </div>
                    <button onClick={() => deleteCustomer(c.id)} className="p-2 text-red-900 hover:text-red-500 transition-colors"><Trash2 className="w-5 h-5" /></button>
                  </div>
                  <div className="space-y-3">
                    {c.orders.map(o => (
                      <div key={o.id} className="bg-black/50 p-4 rounded-xl flex items-center justify-between border border-gray-900">
                        <div>
                          <p className="text-sm font-bold text-gray-300">{o.service}</p>
                          <p className="text-xs text-gray-500 mt-1">{o.details}</p>
                        </div>
                        <button onClick={() => exportPDF(c, o)} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl text-xs flex items-center gap-2 transition-all shadow-lg"><Download className="w-4 h-4" /> تصدير أمر شغل</button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'knowledge' && (
          <div className="max-w-xl space-y-6">
            <h2 className="text-2xl font-bold">إدارة المعرفة والردود</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-500 mb-2 block">رابط المتجر النموذجي</label>
                <input type="text" value={settings.storeUrl} onChange={e => setSettings({...settings, storeUrl: e.target.value})} className="w-full bg-[#111] border border-gray-800 rounded-xl p-3" />
              </div>
              <div>
                <label className="text-sm text-gray-500 mb-2 block">التعليمات الفورية (خصومات، عروض..)</label>
                <textarea rows={5} value={settings.instantInstructions} onChange={e => setSettings({...settings, instantInstructions: e.target.value})} className="w-full bg-[#111] border border-gray-800 rounded-xl p-3" />
              </div>
              <button onClick={saveSettings} className="bg-green-600 px-6 py-3 rounded-xl font-bold w-full">حفظ التغييرات</button>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-md space-y-4">
             <h2 className="text-2xl font-bold">بيانات الدخول</h2>
             <input type="text" placeholder="اسم المستخدم" value={settings.adminUsername} onChange={e => setSettings({...settings, adminUsername: e.target.value})} className="w-full bg-[#111] border border-gray-800 rounded-xl p-3" />
             <input type="password" placeholder="كلمة المرور" value={settings.adminPasswordHash} onChange={e => setSettings({...settings, adminPasswordHash: e.target.value})} className="w-full bg-[#111] border border-gray-800 rounded-xl p-3" />
             <button onClick={saveSettings} className="bg-green-600 px-6 py-3 rounded-xl font-bold w-full">تحديث بيانات الأمان</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
