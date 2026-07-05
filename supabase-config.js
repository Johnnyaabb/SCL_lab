/* ============================================================
   Supabase 连接配置
   在后台 Project Settings → API 里复制以下两项，替换下面的占位符：
   - Project URL      → SUPABASE_URL
   - anon public key  → SUPABASE_ANON_KEY
   这两项都是公开凭证（受 RLS 保护），可以放前端 / 提交到 git。
   ⚠️ 千万不要把 service_role key 或数据库密码放到这里。
   ============================================================ */
window.SUPABASE_URL = "https://你的项目ID.supabase.co";
window.SUPABASE_ANON_KEY = "eyJ...把你的 anon public key 粘到这里...";
