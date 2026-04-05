
const CONFIG = {
  V2BOARD_DOMAIN: "",
  TG_BOT_TOKEN: "",
  ADMIN_CHAT_ID: "",
  DEFAULT_LIMIT: 2,
  ERROR_MSG: "QUA THIET BI - LIEN HE SHOPTUANTRUONG",
  PROFILE_NAME: "SHOPTUANTRUONG",
  SUPPORT_URL: "",
  ALERT_COOLDOWN: 1 * 60 * 60 * 1000,
  ADMIN_PASSWORD: ".",
  // Trang xem phim: dùng cùng domain thì để rỗng "", hoặc điền URL đầy đủ VD: "https://your-site.com/xem-phim"
  XEM_PHIM_BASE: "/xem-phim",
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const ua = (request.headers.get("User-Agent") || "browser").toLowerCase();

    // robots
    if (url.pathname === "/robots.txt") {
      return new Response("User-agent: *\nDisallow: /", { headers: { "Content-Type": "text/plain" } });
    }

    // ===== auth for admin routes =====
    const cookies = request.headers.get("Cookie") || "";
    const isAuth = cookies.includes(`auth=${encodeURIComponent(CONFIG.ADMIN_PASSWORD)}`);

    // login endpoint (POST /login)
    if (request.method === "POST" && url.pathname === "/login") {
      const formData = await request.formData();
      let redirectUrl = formData.get("redirect") || "/opp";
      if (formData.get("pwd") === CONFIG.ADMIN_PASSWORD) {
        return new Response("OK", {
          status: 302,
          headers: {
            "Set-Cookie": `auth=${encodeURIComponent(CONFIG.ADMIN_PASSWORD)}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax`,
            Location: redirectUrl,
          },
        });
      }
      const rUrl = new URL(redirectUrl, url.origin);
      rUrl.searchParams.set("err", "1");
      return Response.redirect(rUrl.toString(), 302);
    }

    const protectedRoutes = ["/opp", "/tonghop"];
    if (protectedRoutes.some((route) => url.pathname.startsWith(route)) && !isAuth) {
      return new Response(HTML_ADMIN_LOGIN(url.searchParams.get("err"), url.pathname + url.search), {
        headers: { "Content-Type": "text/html; charset=utf-8", "X-Robots-Tag": "noindex, nofollow" },
      });
    }

    const htmlHeaders = { "Content-Type": "text/html; charset=utf-8", "X-Robots-Tag": "noindex, nofollow" };

    // admin pages
    if (url.pathname.startsWith("/opp")) return handleAdminPanel(request, env, htmlHeaders);
    if (url.pathname === "/tonghop") return handleSpamRadar(request, env, htmlHeaders);

    // customer pages
    if (url.pathname === "/manage") return handleWebManager(request, env, htmlHeaders);
    if (url.pathname === "/sub") return new Response(HTML_PORTAL_PAGE(), { headers: htmlHeaders });

    // Trang xem phim - trả về app xem phim tùy chỉnh
    if (url.pathname === "/xem-phim" || url.pathname === "/xem-phim/") return new Response(HTML_XEM_PHIM_PAGE(), { headers: htmlHeaders });
    if (url.pathname === "/xem-phim/style.css") return new Response(XEM_PHIM_CSS, { headers: { "Content-Type": "text/css; charset=utf-8" } });
    if (url.pathname === "/xem-phim/app.js") return new Response(XEM_PHIM_JS, { headers: { "Content-Type": "application/javascript; charset=utf-8" } });

    // =====================
    // OPHIM API proxy (tránh CORS)
    // =====================
    if (request.method === "GET" && url.pathname === "/api/ophim-phim") return handleOphimPhim(request, env);
    if (request.method === "GET" && url.pathname === "/api/ophim-search") return handleOphimSearch(request, env);

    // webhook (optional)
    if (request.method === "POST" && url.pathname === "/telegram-webhook") return new Response("OK", { status: 200 });

    // ===== subscribe =====
    if (url.pathname.includes("/api/v1/client/subscribe")) {
      const token = url.searchParams.get("token");
      if (!token) return new Response("Missing Token", { status: 403, headers: { "X-Robots-Tag": "noindex" } });

      // Bot preview/unfurl => show sync page
      const bots = ["telegrambot", "twitterbot", "facebookexternalhit", "slackbot", "whatsapp", "zalo", "discordbot"];
      if (bots.some((bot) => ua.includes(bot))) {
        const userInfo = token ? await getUserInfo(token) : null;
        return new Response(HTML_SYNC_SUB_PAGE(new URL(request.url).origin, token, userInfo), { headers: htmlHeaders });
      }

      // Browser detect: Accept has text/html
      const accept = (request.headers.get("Accept") || "").toLowerCase();
      const isBrowser = accept.includes("text/html");
      const forceRaw = url.searchParams.get("raw") === "1";

      // Browser mo link -> trang dong bo (tru khi raw=1)
      if (isBrowser && !forceRaw) {
        const userInfo = token ? await getUserInfo(token) : null;
        return new Response(HTML_SYNC_SUB_PAGE(new URL(request.url).origin, token, userInfo), { headers: htmlHeaders });
      }

      // App/curl/clients khac -> xu ly limit
      return handleSubscription(request, env, ua);
    }

    // default: luon show trang dong bo (co token neu co)
    const syncToken = url.searchParams.get("token") || "";
    const userInfo = syncToken ? await getUserInfo(syncToken) : null;
    return new Response(HTML_SYNC_SUB_PAGE(new URL(request.url).origin, syncToken, userInfo), { headers: htmlHeaders });
  },

  // 2. ROBOT TU DONG DEP D1 (CHI XOA THIET BI, GIU NGUYEN SLOT)
  async scheduled(event, env, ctx) {
    try {
      // Logic moi: moi khi Cron chay se xoa sach thiet bi + lich su spam
      // nhung giu lai GLOBAL_LIMIT (luu slot)
      await env.SUB_RU.prepare("DELETE FROM devices WHERE fingerprint != 'GLOBAL_LIMIT'").run();
      console.log("Cron chay: da lam moi toan bo thiet bi, giu nguyen Slot khach hang.");
    } catch (e) {
      console.error("Loi Cron D1:", e);
    }
  },
};

// --- BO LOC DU LIEU USER ---
function escapeHtml(text) {
  return text ? text.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") : "";
}

async function getUserInfo(token) {
  try {
    const apiRes = await fetch(`https://${CONFIG.V2BOARD_DOMAIN}/check_user.php?token=${encodeURIComponent(token)}`);
    if (apiRes.ok) {
      const userInfo = await apiRes.json();
      if (userInfo.success && userInfo.email) {
        userInfo.used = parseFloat(userInfo.used);
        userInfo.total = parseFloat(userInfo.total);
        return { success: true, ...userInfo };
      }
      return { success: false, msg: `${userInfo.error || "Token khong hop le / Trong"}` };
    }
    return { success: false, msg: `Lỗi Web: HTTP ${apiRes.status}` };
  } catch (e) {
    return { success: false, msg: `Loi ket noi API CSDL` };
  }
}

// --- MAY QUET THONG TIN (LEVEL MAX) ---
function extractDeviceMeta(request, ua) {
  const ip = request.headers.get("CF-Connecting-IP") || request.headers.get("x-real-ip") || "Unknown IP";
  const city = request.cf?.city || "N/A";
  const region = request.cf?.region || "";
  const country = request.cf?.country || "N/A";
  const isp = request.cf?.asOrganization || `ASN: ${request.cf?.asn || "Unknown"}`;

  const colo = request.cf?.colo || "N/A";
  const rtt = request.cf?.clientTcpRtt ? `${request.cf.clientTcpRtt}ms` : "?";
  const httpProto = request.cf?.httpProtocol || "?";
  const langHeader = request.headers.get("Accept-Language") || "";
  const lang = langHeader.split(",")[0].split(";")[0] || "Unknown";
  const lat = request.cf?.latitude || "";
  const lon = request.cf?.longitude || "";
  const gps = lat && lon ? `${lat}, ${lon}` : "N/A";

  const isVpn =
    request.cf?.corporateProxy === true ||
    (request.cf?.botManagement && request.cf.botManagement.verifiedBot === false) ||
    isp.toLowerCase().match(/(hosting|datacenter|cloud|digitalocean|amazon|google|microsoft|ovh|vultr|linode|hetzner|alibaba|tencent)/) !== null;

  let os = "Unknown OS",
    cpu = "";
  if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("ios") || ua.includes("darwin")) {
    os = "iOS";
    const osMatch = ua.match(/os\s([\d_]+)/i) || ua.match(/ios\/?\s?([\d\.]+)/i);
    if (osMatch) os += ` ${osMatch[1].replace(/_/g, ".")}`;
  } else if (ua.includes("android")) {
    os = "Android";
    const osMatch = ua.match(/android\s([\d\.]+)/i);
    if (osMatch) os += ` ${osMatch[1]}`;
    if (ua.includes("aarch64") || ua.includes("arm64")) cpu = " (ARM64)";
  } else if (ua.includes("windows")) {
    os = "Windows";
    const osMatch = ua.match(/windows nt\s([\d\.]+)/i);
    if (osMatch) {
      if (osMatch[1] === "10.0") os += " 10/11";
      else if (osMatch[1] === "6.3") os += " 8.1";
      else if (osMatch[1] === "6.2") os += " 8";
      else if (osMatch[1] === "6.1") os += " 7";
    }
    if (ua.includes("win64") || ua.includes("x64")) cpu = " (x64)";
    else if (ua.includes("arm64")) cpu = " (ARM64)";
  } else if (ua.includes("macintosh") || ua.includes("mac os")) {
    os = "macOS";
    if (ua.includes("intel")) cpu = " (Intel)";
    else if (ua.includes("arm") || ua.includes("applewebkit")) cpu = " (Apple Silicon)";
  } else if (ua.includes("linux")) {
    os = "Linux";
    if (ua.includes("x86_64")) cpu = " (x64)";
    else if (ua.includes("aarch64") || ua.includes("arm64")) cpu = " (ARM64)";
  }

  let app = "App VPN";
  const appRegexMatch = ua.match(/(shadowrocket|v2rayng|v2rayn|clashmeta|clash|sing-box|hiddify|surge|happ|spectre|karing|stash|quantumult|v2box|incy)\/?\s?([\d\.]+)?/i);
  if (appRegexMatch) {
    app = appRegexMatch[1].charAt(0).toUpperCase() + appRegexMatch[1].slice(1);
    if (appRegexMatch[2]) app += ` v${appRegexMatch[2]}`;
  } else {
    if (ua.includes("dart:io")) app = "Flutter App";
  }

  const fullLocation = region ? `${city}, ${region}, ${country}` : `${city}, ${country}`;
  return { ip, location: fullLocation, isp, os: os + cpu, app, isVpn, colo, rtt, lang, gps, httpProto };
}

// --- QUAN LY D1 ---
async function handleSubscription(request, env, ua) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  // VAN TAY: App goc + OS goc + JA4 (bo version)
  const ja4 = request.cf?.ja4 || "legacy";

  let baseApp = "vpn_app";
  const appList = ["shadowrocket", "v2rayng", "v2rayn", "sing-box", "clashmeta", "clash", "hiddify", "happ", "karing", "surge", "quantumult", "stash", "spectre", "SHOPTUANTRUONGsingbox", "surfboard", "v2box", "incy"];
  for (let a of appList) {
    if (ua.includes(a)) {
      baseApp = a;
      break;
    }
  }

  let baseOs = "unknown_os";
  if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("ios") || ua.includes("darwin")) baseOs = "ios";
  else if (ua.includes("android")) baseOs = "android";
  else if (ua.includes("windows")) baseOs = "windows";
  else if (ua.includes("macintosh") || ua.includes("mac os")) baseOs = "macos";
  else if (ua.includes("linux")) baseOs = "linux";

  const fingerprint = `${baseApp}|${baseOs}|${ja4}`;

  const metaObj = extractDeviceMeta(request, ua);
  const metaJson = JSON.stringify(metaObj);

  let results = [];
  try {
    const dbRes = await env.SUB_RU.prepare("SELECT * FROM devices WHERE token = ?").bind(token).all();
    results = dbRes.results || [];
  } catch (e) {}

  const limitRow = results.find((r) => r.fingerprint === "GLOBAL_LIMIT");
  const limitCount = limitRow ? limitRow.limit_count : CONFIG.DEFAULT_LIMIT;

  const connectedDevices = results.filter((r) => r.fingerprint !== "GLOBAL_LIMIT" && !r.fingerprint.startsWith("SPAM_LOG|"));
  const currentDevice = connectedDevices.find((r) => r.fingerprint === fingerprint);

  // allowed
  if (currentDevice || connectedDevices.length < limitCount) {
    try {
      await env.SUB_RU.prepare("INSERT OR REPLACE INTO devices (token, fingerprint, last_seen, limit_count, meta) VALUES (?, ?, ?, 0, ?)")
        .bind(token, fingerprint, Date.now(), metaJson)
        .run();
      if (!limitRow) {
        await env.SUB_RU.prepare("INSERT OR IGNORE INTO devices (token, fingerprint, limit_count, meta) VALUES (?, 'GLOBAL_LIMIT', ?, NULL)")
          .bind(token, CONFIG.DEFAULT_LIMIT)
          .run();
      }
    } catch (e) {}
    return fetchConfigFromOrigin(request, url, ua);
  }

  // blocked -> spam log + alert
  const spamFp = `SPAM_LOG|${fingerprint}`;
  const spamRow = results.find((r) => r.fingerprint === spamFp);
  let shouldAlert = false,
    spamCount = 1;
  const now = Date.now();

  if (spamRow) {
    spamCount = spamRow.limit_count + 1;
    if (now - spamRow.last_seen > CONFIG.ALERT_COOLDOWN) shouldAlert = true;
    try {
      await env.SUB_RU.prepare("UPDATE devices SET limit_count = ?, last_seen = ?, meta = ? WHERE token = ? AND fingerprint = ?")
        .bind(spamCount, shouldAlert ? now : spamRow.last_seen, metaJson, token, spamFp)
        .run();
    } catch (e) {}
  } else {
    shouldAlert = true;
    try {
      await env.SUB_RU.prepare("INSERT INTO devices (token, fingerprint, last_seen, limit_count, meta) VALUES (?, ?, ?, ?, ?)")
        .bind(token, spamFp, now, 1, metaJson)
        .run();
    } catch (e) {}
  }

  const userInfo = await getUserInfo(token);

  if (shouldAlert) {
    if (userInfo.success && userInfo.id) {
      const syncTime = new Date().toLocaleString("jp-JP", { timeZone: "Asia/Tokyo" });
      const vpnTag = metaObj.isVpn ? " <b>[VPN]</b>" : "";

      let msg = `<b>QUÁ THIẾT BỊ</b>\n------------------\n`;
      msg += `<b>Khách:</b> <code>${userInfo.id}</code> | ${escapeHtml(userInfo.email)}\n`;
      msg += `<b>Data:</b> <code>${userInfo.used}GB / ${userInfo.total}GB</code>\n`;
      msg += `<b>Slot đang dùng:</b> <code>${connectedDevices.length}/${limitCount}</code>\n`;
      msg += `------------------\n`;
      msg += `<b>THIẾT BỊ BỊ CHẶN:</b>\n`;
      msg += `<b>Máy:</b> ${metaObj.app} (${metaObj.os})\n`;
      msg += `<b>Khu vực:</b> ${metaObj.location}\n`;
      msg += `<b>IP:</b> <code>${metaObj.ip}</code>${vpnTag}\n`;
      msg += `<b>ISP:</b> ${metaObj.isp}\n`;
      msg += `<b>Lúc:</b> <code>${syncTime}</code>\n`;
      msg += `<b>Token:</b> <code>${token}</code>`;

      try {
        await fetch(`https://api.telegram.org/bot${CONFIG.TG_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: CONFIG.ADMIN_CHAT_ID,
            text: msg,
            parse_mode: "HTML",
            reply_markup: { inline_keyboard: [[{ text: "⚡ XỬ LÝ TRÊN ADMIN PANEL", url: `${new URL(request.url).origin}/opp?token=${encodeURIComponent(token)}` }]] },
          }),
        });
      } catch (e) {}
    }
  }

  let userIdLine = userInfo.success && userInfo.id ? `[ID: ${userInfo.id}]` : `[T:${token.substring(0, 5)}]`;
  const errorLines = [userIdLine, "VƯỢT", "QUÁ", "THIẾT", "BỊ", "CHO", "PHÉP", "RỒI"];

  if (ua.includes("sing-box") || ua.includes("hiddify") || ua.includes("SHOPTUANTRUONGsingbox")) return returnSingboxError(errorLines);
  if (ua.includes("clash") || ua.includes("stash") || ua.includes("clashmeta")) return returnClashError(errorLines);
  return returnBase64Error(errorLines);
}

// --- TRANG ADMIN PANEL (/opp) ---
async function handleAdminPanel(request, env, headers) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  let connectedDevices = [],
    spamLogs = [],
    limitCount = CONFIG.DEFAULT_LIMIT,
    userInfo = null;

  if (token) {
    const action = url.searchParams.get("action");
    if (action) {
      const dbRes = await env.SUB_RU.prepare("SELECT * FROM devices WHERE token = ? AND fingerprint = 'GLOBAL_LIMIT'").bind(token).all();
      let currentLimit = dbRes.results && dbRes.results.length > 0 ? dbRes.results[0].limit_count : CONFIG.DEFAULT_LIMIT;

      if (action === "reset") await env.SUB_RU.prepare("DELETE FROM devices WHERE token = ? AND fingerprint != 'GLOBAL_LIMIT' AND fingerprint NOT LIKE 'SPAM_LOG|%'").bind(token).run();
      else if (action === "clearspam") await env.SUB_RU.prepare("DELETE FROM devices WHERE token = ? AND fingerprint LIKE 'SPAM_LOG|%'").bind(token).run();
      else if (action === "add") await env.SUB_RU.prepare("INSERT OR REPLACE INTO devices (token, fingerprint, limit_count, meta) VALUES (?, 'GLOBAL_LIMIT', ?, NULL)").bind(token, currentLimit + 1).run();
      else if (action === "minus") await env.SUB_RU.prepare("INSERT OR REPLACE INTO devices (token, fingerprint, limit_count, meta) VALUES (?, 'GLOBAL_LIMIT', ?, NULL)").bind(token, Math.max(1, currentLimit - 1)).run();
      else if (action.startsWith("del_")) {
        const res = await env.SUB_RU.prepare("SELECT fingerprint FROM devices WHERE token = ? AND fingerprint != 'GLOBAL_LIMIT' AND fingerprint NOT LIKE 'SPAM_LOG|%' ORDER BY last_seen DESC").bind(token).all();
        const idx = parseInt(action.split("_")[1], 10);
        if (res.results && res.results[idx]) await env.SUB_RU.prepare("DELETE FROM devices WHERE token = ? AND fingerprint = ?").bind(token, res.results[idx].fingerprint).run();
      }
      return Response.redirect(`${url.origin}/opp?token=${encodeURIComponent(token)}`, 302);
    }

    const dbResAll = await env.SUB_RU.prepare("SELECT * FROM devices WHERE token = ? ORDER BY last_seen DESC").bind(token).all();
    const resultsAll = dbResAll.results || [];
    const limitRow = resultsAll.find((r) => r.fingerprint === "GLOBAL_LIMIT");
    limitCount = limitRow ? limitRow.limit_count : CONFIG.DEFAULT_LIMIT;
    connectedDevices = resultsAll.filter((r) => r.fingerprint !== "GLOBAL_LIMIT" && !r.fingerprint.startsWith("SPAM_LOG|"));
    spamLogs = resultsAll.filter((r) => r.fingerprint.startsWith("SPAM_LOG|"));
    userInfo = await getUserInfo(token);
  }

  return new Response(HTML_ADMIN_DASHBOARD(token, connectedDevices, spamLogs, limitCount, userInfo), { headers });
}

// --- KHACH TU QUAN LY (/manage) ---
async function handleWebManager(request, env, headers) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) return new Response("Vui long cung cap token tren URL.", { status: 400, headers });

  const delIdx = url.searchParams.get("del");
  if (delIdx !== null) {
    const res = await env.SUB_RU.prepare("SELECT fingerprint FROM devices WHERE token = ? AND fingerprint != 'GLOBAL_LIMIT' AND fingerprint NOT LIKE 'SPAM_LOG|%' ORDER BY last_seen DESC").bind(token).all();
    if (res.results && res.results[delIdx]) {
      await env.SUB_RU.prepare("DELETE FROM devices WHERE token = ? AND fingerprint = ?").bind(token, res.results[delIdx].fingerprint).run();
      return Response.redirect(`${url.origin}/manage?token=${encodeURIComponent(token)}`, 302);
    }
  }

  const dbRes = await env.SUB_RU.prepare("SELECT * FROM devices WHERE token = ? ORDER BY last_seen DESC").bind(token).all();
  const results = dbRes.results || [];
  const limitRow = results.find((r) => r.fingerprint === "GLOBAL_LIMIT");
  const limitCount = limitRow ? limitRow.limit_count : CONFIG.DEFAULT_LIMIT;
  const connectedDevices = results.filter((r) => r.fingerprint !== "GLOBAL_LIMIT" && !r.fingerprint.startsWith("SPAM_LOG|"));

  const userInfo = await getUserInfo(token);
  const userInfoText = userInfo.success ? `${escapeHtml(userInfo.email)} (Gói: ${escapeHtml(userInfo.plan)})` : `<span style="color:#ef4444; font-weight:bold;">${escapeHtml(userInfo.msg)}</span>`;

  return new Response(HTML_MANAGER_PAGE(token, connectedDevices, limitCount, userInfoText, `${url.origin}/api/v1/client/subscribe?token=${token}`), { headers });
}

// --- TRANG TONG HOP SPAM (/tonghop) ---
async function handleSpamRadar(request, env, headers) {
  let htmlList = "";
  try {
    const dbRes = await env.SUB_RU.prepare(
      `SELECT token, SUM(limit_count) as total_spam, MAX(last_seen) as last_time, meta
       FROM devices
       WHERE fingerprint LIKE 'SPAM_LOG|%'
       GROUP BY token
       ORDER BY total_spam DESC
       LIMIT 50`
    ).all();

    if (dbRes.results && dbRes.results.length > 0) {
      const maxSpam = dbRes.results[0].total_spam || 1;
      htmlList = dbRes.results
        .map((r, idx) => {
          const timeStr = new Date(r.last_time).toLocaleString("jp-JP", { timeZone: "Asia/Tokyo" });
          const pct = Math.max(5, (r.total_spam / maxSpam) * 100);
          let m = { os: "?", app: "?", location: "?" };
          try {
            if (r.meta) m = JSON.parse(r.meta);
          } catch (e) {}
          return `<div class="spam-card"><div class="spam-header"><span class="rank">#${idx + 1}</span><code class="token">${escapeHtml(r.token.substring(0, 16))}...</code><button class="btn-action" onclick="window.open('/opp?token=${encodeURIComponent(r.token)}', '_blank')">Quản lý</button></div><div class="spam-stats"><div style="font-size:13px; color:#94a3b8; margin-bottom: 5px;">Bị chặn: <strong style="color:#ef4444;">${r.total_spam} lần</strong> - Gần nhất: ${timeStr} <br><span style="color:#64748b; font-size:12px;">${escapeHtml(m.app)} (${escapeHtml(m.os)}) | ${escapeHtml(m.location)}</span></div><div class="progress-bg"><div class="progress-bar" style="width: ${pct}%;"></div></div></div></div>`;
        })
        .join("");
    } else {
      htmlList = `<div style="text-align:center; color:#10b981; padding: 40px;">Hệ thống sạch sẽ, chưa có máy nào vượt rào!</div>`;
    }
  } catch (e) {
    htmlList = `<div style="color:red">Lỗi truy vấn D1: ${escapeHtml(e.message || String(e))}</div>`;
  }
  return new Response(HTML_RADAR_PAGE(htmlList), { headers });
}

// --- OPHIM SEARCH (proxy) ---
async function handleOphimSearch(request, env) {
  const url = new URL(request.url);
  const keyword = (url.searchParams.get("q") || url.searchParams.get("keyword") || "").trim();
  if (!keyword) {
    return new Response(JSON.stringify({ status: "error", message: "Missing keyword" }), {
      status: 400,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }

  // OPhim search endpoint (from their API docs)
  // https://ophim1.com/v1/api/tim-kiem?keyword=...
  const targetUrl = `https://ophim1.com/v1/api/tim-kiem?keyword=${encodeURIComponent(keyword)}`;

  try {
    const response = await fetch(targetUrl, {
      method: "GET",
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    const resHeaders = new Headers(response.headers);
    // Ensure JSON content-type for the browser UI.
    resHeaders.set("Content-Type", "application/json; charset=utf-8");
    return new Response(response.body, { status: response.status, headers: resHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ status: "error", message: `OPhim fetch failed: ${e.message || String(e)}` }), {
      status: 502,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }
}

// --- OPHIM PHIM DETAIL (proxy) ---
async function handleOphimPhim(request, env) {
  const url = new URL(request.url);
  const slug = (url.searchParams.get("slug") || "").trim();
  if (!slug) {
    return new Response(JSON.stringify({ status: "error", message: "Missing slug" }), {
      status: 400,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }
  const targetUrl = `https://ophim1.com/v1/api/phim/${encodeURIComponent(slug)}`;
  try {
    const response = await fetch(targetUrl, {
      method: "GET",
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    const resHeaders = new Headers(response.headers);
    resHeaders.set("Content-Type", "application/json; charset=utf-8");
    return new Response(response.body, { status: response.status, headers: resHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ status: "error", message: `OPhim fetch failed: ${e.message || String(e)}` }), {
      status: 502,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }
}

// --- FETCH GOC & TAO LOI ---
function detectFlag(ua) {
  if (!ua) return "v2rayng";
  if (ua.includes("sing-box") || ua.includes("SHOPTUANTRUONGsingbox")) return "sing-box";
  if (ua.includes("dart:io")) return "sing";
  if (ua.includes("clashmeta") || ua.includes("clash")) return "clashmeta";
  if (ua.includes("incy")) return "incy";
  if (ua.includes("v2box")) return "v2box";
  if (ua.includes("shadowrocket")) return "shadowrocket";
  if (ua.includes("surge")) return "surge";
  if (ua.includes("quantumult")) return "quantumult";
  if (ua.includes("stash")) return "stash";
  if (ua.includes("spectre") || ua.includes("happ/")) return "happ";
  return "v2rayng";
}

async function fetchConfigFromOrigin(request, originalUrl, ua) {
  const cleanPathname = originalUrl.pathname.replace(/\/$/, "");
  const params = new URLSearchParams(originalUrl.search);
  if (!params.has("flag")) params.set("flag", detectFlag(ua));
  const targetUrl = `https://${CONFIG.V2BOARD_DOMAIN}${cleanPathname}?${params.toString()}`;

  const newHeaders = new Headers(request.headers);
  newHeaders.set("Host", CONFIG.V2BOARD_DOMAIN);

  try {
    const response = await fetch(targetUrl, { method: request.method, headers: newHeaders });

    const resHeaders = new Headers(response.headers);
    let profileTitle = CONFIG.PROFILE_NAME;
    if (ua.includes("happ")) {
      const d = new Date(new Date().getTime() + 9 * 3600 * 1000);
      profileTitle +=
        " " +
        `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
    }

    resHeaders.set("profile-title", profileTitle);
    resHeaders.set("profile-update-interval", "2");
    resHeaders.set("support-url", CONFIG.SUPPORT_URL);
    resHeaders.set("profile-web-page-url", CONFIG.SUPPORT_URL);

    return new Response(response.body, { status: response.status, headers: resHeaders });
  } catch (error) {
    if (ua.includes("clash") || ua.includes("clashmeta")) return returnClashError(["Loi ket noi goc"]);
    return returnBase64Error(["Loi ket noi toi Server goc"]);
  }
}

function returnSingboxError(lines) {
  const proxyOutbounds = lines.map((tag) => ({ type: "trojan", tag, server: "127.0.0.1", server_port: 443, password: "0" }));
  const json = {
    dns: { servers: [{ tag: "dns", address: "8.8.8.8" }], final: "dns" },
    outbounds: [{ type: "selector", tag: "Proxy", outbounds: lines }, ...proxyOutbounds, { type: "direct", tag: "direct" }],
    route: { rules: [{ outbound: "Proxy" }] },
  };
  return new Response(JSON.stringify(json), { headers: { "Content-Type": "application/json" } });
}

function returnBase64Error(lines) {
  let s = "";
  lines.forEach((line) => {
    const v = { v: "2", ps: line, add: "127.0.0.1", port: "443", id: "0-0-0-0-0", aid: "0", net: "tcp", type: "none" };
    s += `vmess://${btoa(unescape(encodeURIComponent(JSON.stringify(v))))}\n`;
  });
  return new Response(btoa(unescape(encodeURIComponent(s))), { headers: { "Content-Type": "text/plain" } });
}

function returnClashError(lines) {
  const proxies = lines.map((line) => `  - {name: "${line}", type: trojan, server: 127.0.0.1, port: 443, password: "0", skip-cert-verify: true}`).join("\n");
  const proxyNames = lines.map((line) => `"${line}"`).join(", ");
  return new Response(`proxies:\n${proxies}\nproxy-groups:\n  - {name: "SHOPTUANTRUONG-LIMIT", type: select, proxies: [${proxyNames}]}`, {
    headers: { "Content-Type": "text/yaml; charset=utf-8" },
  });
}

// --- GIAO DIEN HTML ---
function buildDeviceHTML(r, idx, token, isAdmin) {
  let m = { app: "N/A", os: "N/A", location: "N/A", ip: "N/A", isp: "N/A", isVpn: false, colo: "?", rtt: "?", lang: "?", gps: "?", httpProto: "?" };
  try {
    if (r.meta) m = JSON.parse(r.meta);
  } catch (e) {}
  const t = r.last_seen ? new Date(r.last_seen).toLocaleString("jp-JP", { timeZone: "Asia/Tokyo" }) : "Không rõ";
  const deleteAction = isAdmin ? `/opp?token=${encodeURIComponent(token)}&action=del_${idx}` : `/manage?token=${encodeURIComponent(token)}&del=${idx}`;
  const ipTag = m.isVpn ? ` <span style="color:#ef4444; font-size:10px; font-weight:bold; background:#281111; padding:2px 4px; border-radius:4px;">[VPN/Server]</span>` : "";
  return `
  <div class="device-card" style="position: relative; overflow: hidden; background: #334155; padding: 15px; border-radius: 10px; margin-bottom: 12px;">
    <div style="position: absolute; top: 10px; right: 15px; font-size: 11px; color: #94a3b8; text-align: right; line-height: 1.4;">
      Ping: <span style="color:#38bdf8">${escapeHtml(m.rtt)}</span><br>
      Trạm: ${escapeHtml(m.colo)}<br>
      NN: ${escapeHtml(m.lang)}
    </div>
    <div class="device-info" style="padding-right: 70px;">
      <div class="app-name" style="font-weight: bold; font-size: 16px; color: #f8fafc; margin-bottom: 8px;">${escapeHtml(m.app)} <span style="color:#94a3b8;font-weight:normal;font-size:13px">(${escapeHtml(m.os)})</span></div>
      <div class="meta-row" style="font-size: 13px; color: #cbd5e1; margin-bottom: 4px;"><b>Khu vực:</b> ${escapeHtml(m.location)} <span style="color:#64748b; font-size:11px">(${escapeHtml(m.gps)})</span></div>
      <div class="meta-row" style="font-size: 13px; color: #cbd5e1; margin-bottom: 4px;"><b>IP:</b> ${escapeHtml(m.ip)}${ipTag}</div>
      <div class="meta-row" style="color:#64748b; font-size:12px; margin-bottom: 4px;">${escapeHtml(m.isp)} • ${escapeHtml(m.httpProto)}</div>
      <div class="meta-row" style="margin-top: 6px; font-size: 13px; color: #cbd5e1;"><b>Lần cuối:</b> ${t}</div>
    </div>
    <button class="btn-del" onclick="if(confirm('Xóa thiết bị này ra khỏi mạng?')) window.location.href='${deleteAction}'" style="width:100%; margin-top:12px; padding: 10px; background:#ef4444; color:white; border:none; border-radius:8px; cursor:pointer; font-weight:bold; transition:0.2s;">Xóa thiết bị này</button>
  </div>`;
}

function HTML_ADMIN_LOGIN(err, redirect) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="robots" content="noindex, nofollow"><title>Cổng Bí Mật</title><style>
body { background: #020617; color: white; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; font-family: monospace; }
.box { background: #0f172a; padding: 30px; border-radius: 10px; border: 1px solid #334155; text-align: center; box-shadow: 0 0 30px rgba(56, 189, 248, 0.2); }
input { background: #1e293b; border: 1px solid #475569; color: white; padding: 10px; width: 200px; text-align: center; font-size: 20px; outline: none; border-radius: 5px; margin-bottom: 10px;}
button { background: #38bdf8; color: #0f172a; border: none; padding: 10px 20px; font-weight: bold; cursor: pointer; border-radius: 5px; width: 100%;}
p { color: #ef4444; font-size: 12px; display: ${err ? "block" : "none"};}
</style></head><body><div class="box"><h3>ACCESS REQUIRED</h3>
<form method="POST" action="/login">
  <input type="hidden" name="redirect" value="${escapeHtml(redirect)}">
  <input type="password" name="pwd" autocomplete="off" autofocus>
  <p>Sai mật khẩu!</p>
  <button type="submit">ENTER</button>
</form>
</div></body></html>`;
}

function HTML_RADAR_PAGE(list) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="robots" content="noindex, nofollow"><title>SHOPTUANTRUONG SPAM RADAR</title><style>
body { font-family: -apple-system, sans-serif; background: #020617; color: #f8fafc; margin: 0; padding: 20px; }
.container { max-width: 800px; margin: 0 auto; }
h1 { text-align: center; color: #ef4444; font-family: monospace; letter-spacing: 2px; text-shadow: 0 0 10px rgba(239, 68, 68, 0.5);}
.nav-links { text-align: center; margin-bottom: 30px; }
.nav-links a { color: #38bdf8; text-decoration: none; font-weight: bold; margin: 0 10px; border: 1px solid #38bdf8; padding: 8px 15px; border-radius: 20px; transition: 0.3s; }
.nav-links a:hover { background: #38bdf8; color: #020617; }
.spam-card { background: #0f172a; border: 1px solid #334155; border-radius: 12px; padding: 15px; margin-bottom: 15px; box-shadow: 0 4px 15px rgba(0,0,0,0.3); }
.spam-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.rank { font-size: 20px; font-weight: 900; color: #f59e0b; width: 40px; }
.token { flex: 1; color: #94a3b8; font-family: monospace; font-size: 14px; background: #1e293b; padding: 5px 10px; border-radius: 5px; margin: 0 10px; word-break: break-all;}
.btn-action { background: #38bdf8; color: #0f172a; border: none; padding: 6px 12px; border-radius: 6px; font-weight: bold; cursor: pointer; transition: 0.2s;}
.btn-action:hover { background: #0284c7; color: white; }
.progress-bg { background: #1e293b; height: 10px; border-radius: 5px; overflow: hidden; width: 100%; }
.progress-bar { background: linear-gradient(90deg, #f59e0b, #ef4444); height: 100%; border-radius: 5px; box-shadow: 0 0 10px rgba(239, 68, 68, 0.8);}
</style></head><body><div class="container"><h1>SHOPTUANTRUONG SPAM RADAR</h1><div class="nav-links"><a href="/opp">Quay lại Admin</a></div>${list}</div></body></html>`;
}

function HTML_ADMIN_DASHBOARD(token, connectedDevices, spamLogs, limitCount, userInfo) {
  let infoHTML = "";
  if (token) {
    let uiData =
      userInfo && userInfo.success
        ? `<p><b>ID:</b> ${escapeHtml(userInfo.id)}  |  <b>Mail:</b> ${escapeHtml(userInfo.email)}</p><p><b>Gói:</b> <span class="text-green">${escapeHtml(userInfo.plan)}</span></p><p><b>Data:</b> ${escapeHtml(userInfo.used)}GB / ${escapeHtml(userInfo.total)}GB</p><p><b>HSD:</b> ${escapeHtml(userInfo.expire)}</p>`
        : `<p class="text-red">${escapeHtml(userInfo?.msg || "Không lấy được thông tin CSDL")}</p>`;

    let listHTML = connectedDevices.map((r, idx) => buildDeviceHTML(r, idx, token, true)).join("");
    if (connectedDevices.length === 0) listHTML = `<div class="text-gray">Chưa kết nối thiết bị hợp lệ nào.</div>`;

    let spamCount = spamLogs.reduce((acc, cur) => acc + (cur.limit_count || 0), 0);
    let spamBadge =
      spamCount > 0 ? `<span style="background:#ef4444; color:white; padding:2px 8px; border-radius:10px; font-size:12px; float:right;">Cố tình spam: ${spamCount} lần</span>` : "";

    infoHTML = `<div class="card"><h3 class="title">THÔNG TIN KHÁCH HÀNG</h3>${uiData}</div>
    <div class="card">
      <h3 class="title">QUẢN LÝ SLOT: <span class="text-blue">${connectedDevices.length} / ${limitCount}</span> ${spamBadge}</h3>
      <div class="action-grid">
        <button class="btn-add" onclick="window.location.href='/opp?token=${encodeURIComponent(token)}&action=add'">Thêm Slot</button>
        <button class="btn-minus" onclick="window.location.href='/opp?token=${encodeURIComponent(token)}&action=minus'">Bớt Slot</button>
        <button class="btn-reset" onclick="if(confirm('Chắc chắn reset thiết bị?')) window.location.href='/opp?token=${encodeURIComponent(token)}&action=reset'">Reset thiết bị</button>
      </div>
      <div class="dev-list">${listHTML}</div>
      ${
        spamCount > 0
          ? `<button onclick="if(confirm('Xóa lịch sử chặn của token này?')) window.location.href='/opp?token=${encodeURIComponent(token)}&action=clearspam'" style="margin-top:15px; background:transparent; border:1px solid #ef4444; color:#ef4444; padding:5px 10px; border-radius:5px; cursor:pointer; width:100%;">Xóa lịch sử spam</button>`
          : ""
      }
    </div>`;
  }

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="robots" content="noindex, nofollow"><title>ADMIN DASHBOARD</title><style>
body { font-family: -apple-system, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 20px; }
.container { max-width: 600px; margin: 0 auto; }
h1 { text-align: center; color: #38bdf8; font-family: monospace; margin-bottom: 5px;}
.radar-link { display: block; text-align: center; color: #f59e0b; text-decoration: none; margin-bottom: 25px; font-weight: bold; font-size: 14px;}
.radar-link:hover { text-decoration: underline; }
.search-box { display: flex; gap: 10px; margin-bottom: 20px; }
input { flex: 1; padding: 12px; border-radius: 8px; border: 1px solid #334155; background: #1e293b; color: white; outline: none; }
button.btn-search { padding: 12px 20px; background: #38bdf8; color: #0f172a; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; }
.card { background: #1e293b; padding: 20px; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
.title { margin-top: 0; border-bottom: 1px solid #334155; padding-bottom: 10px; color: #94a3b8; font-size: 16px; }
p { margin: 8px 0; font-size: 15px;}
.text-green { color: #10b981; font-weight: bold; }
.text-red { color: #ef4444; }
.text-blue { color: #38bdf8; font-size: 20px;}
.text-gray { color: #64748b; font-style: italic; text-align: center; padding: 10px;}
.action-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 20px; }
.action-grid button { padding: 12px; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; color: white; transition: 0.2s;}
.btn-add { background: #10b981; }
.btn-minus { background: #f59e0b; }
.btn-reset { background: #ef4444; }
.dev-list { display: flex; flex-direction: column; gap: 10px; }
</style></head><body><div class="container"><h1>SHOPTUANTRUONG ADMIN PANEL</h1>
<a href="/tonghop" class="radar-link">Mở bảng SPAM RADAR</a>
<div class="search-box">
  <input type="text" id="searchInput" placeholder="Dán token hoặc link sub khách" value="${escapeHtml(token || "")}">
  <button class="btn-search" onclick="doSearch()">Tra cứu</button>
</div>
${infoHTML}
</div>
<script>
function doSearch() {
  let val = document.getElementById('searchInput').value.trim();
  if (!val) return;
  let t = val;
  try { if (val.includes('token=')) t = new URL(val).searchParams.get('token'); } catch(e){}
  window.location.href = '/opp?token=' + encodeURIComponent(t);
}
</script>
</body></html>`;
}

function HTML_PORTAL_PAGE() {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="robots" content="noindex, nofollow"><title>Quản Lý - SHOPTUANTRUONG</title><style>
body { font-family: -apple-system, sans-serif; background: #0f172a; color: #f8fafc; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
.card { text-align: center; background: #1e293b; padding: 2.5rem; border-radius: 1.5rem; max-width: 450px; width: 100%; box-shadow: 0 20px 50px rgba(0,0,0,0.5); }
h2 { color: #38bdf8; margin-top: 0; }
input { width: 100%; padding: 15px; border-radius: 10px; border: 1px solid #334155; background: #0f172a; color: white; margin-bottom: 20px; box-sizing: border-box; font-size: 14px; outline: none; }
button { width: 100%; padding: 15px; border-radius: 10px; border: none; background: #38bdf8; color: #0f172a; font-weight: bold; font-size: 16px; cursor: pointer; }
</style></head><body><div class="card"><h2>QUẢN LÝ THIẾT BỊ</h2>
<p style="color:#94a3b8; font-size:14px; margin-bottom:25px;">Dán Link Đồng Bộ VPN (hoặc mã Token) để xóa thiết bị cũ.</p>
<input type="text" id="subInput" placeholder="VD: https://domain/api/v1/client/subscribe?token=abc...">
<button onclick="processSub()">Tiếp Tục</button></div>
<script>
function processSub() {
  let val = document.getElementById('subInput').value.trim();
  if (!val) return alert('Vui lòng nhập Link đồng bộ hoặc Token!');
  let token = val;
  try { if (val.includes('token=')) token = new URL(val).searchParams.get('token'); } catch(e) {}
  if(token && token.length > 10) window.location.href = '/manage?token=' + encodeURIComponent(token);
  else alert('Link hoặc Token không hợp lệ!');
}
</script>
</body></html>`;
}

function HTML_MANAGER_PAGE(token, connectedDevices, limitCount, userInfoText, syncLink) {
  let listHTML = connectedDevices.map((r, idx) => buildDeviceHTML(r, idx, token, false)).join("");
  if (connectedDevices.length === 0) listHTML = `<div style="text-align:center; color:#94a3b8; padding: 20px; font-style: italic;">Khách chưa kết nối hoặc đã xóa sạch thiết bị cũ.</div>`;
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="robots" content="noindex, nofollow"><title>Thiết Bị Của Bạn - SHOPTUANTRUONG</title><style>
body { font-family: -apple-system, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 20px; }
.container { max-width: 600px; margin: 0 auto; background: #1e293b; padding: 25px; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
h2 { color: #38bdf8; margin-top: 0; text-align: center; border-bottom: 1px solid #334155; padding-bottom: 15px; }
.info-box { background: #0f172a; padding: 15px; border-radius: 10px; margin-bottom: 20px; font-size: 14px; color: #cbd5e1; border-left: 4px solid #38bdf8;}
.info-box span { color: #10b981; font-weight: bold; }
.sync-box { margin-top: 25px; text-align: center; background: #0f172a; padding: 20px; border-radius: 12px; border: 1px dashed #38bdf8;}
.btn-sync { background: #10b981; color: white; width: 100%; border: none; padding: 12px; border-radius: 8px; font-size: 16px; font-weight: bold; cursor: pointer; }
</style></head><body><div class="container"><h2>THIẾT BỊ CỦA BẠN</h2>
<div class="info-box"><div>Khách hàng: <span>${userInfoText}</span></div><div style="margin-top: 5px;">Số slot đang dùng: <span>${connectedDevices.length} / ${limitCount}</span></div></div>
<div class="device-list">${listHTML}</div>
<div class="sync-box"><p style="color:#94a3b8; font-size:14px; margin-top:0; margin-bottom:15px;">Sau khi xóa thiết bị cũ, hãy copy link dưới đây để dán vào App VPN trên máy mới nhé!</p>
<button class="btn-sync" onclick="copySync()">COPY LINK ĐỒNG BỘ</button></div></div>
<script>
function copySync() {
  navigator.clipboard.writeText("${escapeHtml(syncLink)}").then(() => {
    alert("Da Copy Link Dong Bo thanh cong!\\nHay mo app VPN dan vao phan Import.");
  });
}
</script></body></html>`;
}

// =====================
// TRANG XEM PHIM (OPhim)
// =====================
function HTML_XEM_PHIM_PAGE() {
  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Xem Phim - OPhim API</title>
<link rel="stylesheet" href="/xem-phim/style.css">
</head>
<body>
<div class="container">
<header>
<h1>🎬 Xem Phim Online</h1>
</header>
<div id="noSlug" class="no-slug" style="display:none;">
<p>Chưa chọn phim.</p>
</div>
<div id="movieDetail" class="movie-detail">
<div id="detailContent"></div>
</div>
</div>
<script src="/xem-phim/app.js"></script>
</body>
</html>`;
}

const XEM_PHIM_CSS = `/* ===== Reset & Base ===== */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

:root {
    --primary: #a78bfa;
    --primary-dark: #7c3aed;
    --accent: #f472b6;
    --glass: rgba(255, 255, 255, 0.05);
    --glass-border: rgba(255, 255, 255, 0.1);
    --glow: 0 0 40px rgba(167, 139, 250, 0.3);
}

body {
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    min-height: 100vh;
    color: #e4e4e7;
    overflow-x: hidden;
}

/* ===== Animated Background ===== */
body::before {
    content: '';
    position: fixed;
    inset: 0;
    background: 
        radial-gradient(ellipse 80% 50% at 20% -20%, rgba(124, 58, 237, 0.4), transparent),
        radial-gradient(ellipse 60% 40% at 80% 100%, rgba(244, 114, 182, 0.25), transparent),
        linear-gradient(135deg, #0f0f23 0%, #1a1a2e 40%, #16213e 100%);
    z-index: -1;
    animation: bgShift 15s ease-in-out infinite alternate;
}

@keyframes bgShift {
    0% { opacity: 1; filter: hue-rotate(0deg); }
    100% { opacity: 1; filter: hue-rotate(5deg); }
}

/* Floating orbs */
body::after {
    content: '';
    position: fixed;
    width: 600px;
    height: 600px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(167, 139, 250, 0.15) 0%, transparent 70%);
    top: -200px;
    right: -200px;
    z-index: -1;
    animation: float 20s ease-in-out infinite;
}

@keyframes float {
    0%, 100% { transform: translate(0, 0) scale(1); }
    50% { transform: translate(-50px, 50px) scale(1.1); }
}

/* ===== Container ===== */
.container {
    max-width: 1400px;
    margin: 0 auto;
    padding: 20px;
    animation: fadeIn 0.6s ease-out;
}

@keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
}

/* ===== Header ===== */
header {
    padding: 24px 0;
    margin-bottom: 32px;
    border-bottom: 1px solid var(--glass-border);
    backdrop-filter: blur(10px);
}

h1 {
    font-size: 2rem;
    font-weight: 800;
    background: linear-gradient(135deg, #f472b6, #a78bfa, #60a5fa);
    background-size: 200% auto;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    animation: gradientFlow 4s linear infinite;
    letter-spacing: -0.02em;
}

@keyframes gradientFlow {
    0% { background-position: 0% center; }
    100% { background-position: 200% center; }
}

/* ===== No slug placeholder ===== */
.no-slug {
    text-align: center;
    padding: 60px 20px;
    color: rgba(255, 255, 255, 0.8);
}

.no-slug p {
    margin-bottom: 20px;
    font-size: 1.1rem;
}

/* ===== Back Button ===== */
.btn-back {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    background: var(--glass);
    backdrop-filter: blur(12px);
    border: 1px solid var(--glass-border);
    border-radius: 10px;
    color: #e4e4e7;
    text-decoration: none;
    margin-bottom: 20px;
    font-size: 0.95rem;
    transition: all 0.3s ease;
}

.btn-back:hover {
    background: rgba(167, 139, 250, 0.2);
    border-color: var(--primary);
    transform: translateX(-4px);
}

/* ===== Movie Detail ===== */
.movie-detail {
    display: none;
}

.movie-detail.active {
    display: block;
    animation: slideUp 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes slideUp {
    from {
        opacity: 0;
        transform: translateY(20px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.detail-header {
    display: flex;
    gap: 32px;
    margin-bottom: 32px;
    flex-wrap: wrap;
}

.poster-with-action {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 16px;
    align-items: center;
}

.detail-poster {
    width: 300px;
    aspect-ratio: 2/3;
    border-radius: 16px;
    overflow: hidden;
    border: 2px solid var(--glass-border);
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
    animation: posterPop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.btn-xem-ngay {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 12px 28px;
    background: linear-gradient(135deg, var(--primary-dark), var(--primary));
    border: none;
    border-radius: 999px;
    color: #fff;
    font-size: 1rem;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 4px 24px rgba(167, 139, 250, 0.4);
    transition: transform 0.2s, box-shadow 0.2s;
}

.btn-xem-ngay:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 32px rgba(167, 139, 250, 0.5);
}

.btn-xem-icon {
    font-size: 0.9rem;
}

@keyframes posterPop {
    from {
        opacity: 0;
        transform: scale(0.9);
    }
    to {
        opacity: 1;
        transform: scale(1);
    }
}

.detail-poster img {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
}

.detail-info {
    flex: 1;
    min-width: 280px;
}

.detail-info h2 {
    font-size: 2rem;
    margin-bottom: 8px;
    font-weight: 700;
    background: linear-gradient(135deg, #fff, rgba(255, 255, 255, 0.8));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}

.detail-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 12px 20px;
    margin: 16px 0;
    font-size: 0.9rem;
    color: rgba(255, 255, 255, 0.75);
}

.detail-meta span {
    display: inline-flex;
    align-items: center;
    padding: 6px 12px;
    background: var(--glass);
    border-radius: 8px;
    border: 1px solid var(--glass-border);
}

.content-block {
    margin: 24px 0;
    padding: 20px;
    background: var(--glass);
    backdrop-filter: blur(12px);
    border-radius: 12px;
    border: 1px solid var(--glass-border);
}

.content-block h3 {
    font-size: 1rem;
    margin-bottom: 12px;
    color: var(--primary);
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
}

.content-block h3::before {
    content: '';
    width: 4px;
    height: 1em;
    background: linear-gradient(180deg, var(--primary), var(--accent));
    border-radius: 2px;
}

.content-block p,
.content-block ul {
    font-size: 0.95rem;
    line-height: 1.7;
    color: rgba(255, 255, 255, 0.9);
}

.actor-list {
    list-style: none;
    display: flex;
    flex-wrap: wrap;
    gap: 20px;
}

.actor-list .actor-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 12px;
    background: linear-gradient(135deg, rgba(167, 139, 250, 0.15), rgba(244, 114, 182, 0.1));
    border-radius: 16px;
    border: 1px solid rgba(167, 139, 250, 0.25);
    transition: all 0.3s ease;
    min-width: 100px;
}

.actor-list .actor-item:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 24px rgba(167, 139, 250, 0.3);
    border-color: rgba(167, 139, 250, 0.5);
}

.actor-avatar {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid rgba(167, 139, 250, 0.4);
}

.actor-name {
    font-size: 0.85rem;
    text-align: center;
    line-height: 1.3;
    max-width: 100px;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
}

/* ===== Player Modal ===== */
.player-modal {
    position: fixed;
    inset: 0;
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.3s, visibility 0.3s;
}

.player-modal.show {
    opacity: 1;
    visibility: visible;
}

.player-modal-backdrop {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.85);
    cursor: pointer;
}

.player-modal-content {
    position: relative;
    width: 100%;
    max-width: 960px;
    background: #0f0f1a;
    border-radius: 16px;
    overflow: hidden;
    border: 2px solid var(--glass-border);
    box-shadow: 0 25px 80px rgba(0, 0, 0, 0.8);
}

.player-modal-close {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 40px;
    height: 40px;
    border: none;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.15);
    color: #fff;
    font-size: 1.5rem;
    line-height: 1;
    cursor: pointer;
    z-index: 10;
    transition: background 0.2s;
}

.player-modal-close:hover {
    background: rgba(255, 255, 255, 0.25);
}

/* ===== Video Player ===== */
.player-section {
    background: #000;
    overflow: hidden;
}

.player-section iframe {
    width: 100%;
    aspect-ratio: 16/9;
    border: none;
    display: block;
}

.player-controls {
    padding: 16px 20px;
    background: rgba(0, 0, 0, 0.5);
    border-top: 1px solid var(--glass-border);
}

.player-controls-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
}

.player-controls-row:last-child {
    margin-bottom: 0;
}

.player-controls-label {
    font-size: 0.85rem;
    color: rgba(255, 255, 255, 0.7);
    min-width: 50px;
}

.player-controls .server-tabs,
.player-controls .episodes {
    margin: 0;
}

.episodes {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin: 16px 0;
}

.ep-btn {
    padding: 10px 18px;
    background: var(--glass);
    border: 1px solid var(--glass-border);
    border-radius: 10px;
    color: #e4e4e7;
    cursor: pointer;
    font-size: 0.9rem;
    transition: all 0.3s ease;
}

.ep-btn:hover {
    background: rgba(167, 139, 250, 0.2);
    border-color: var(--primary);
    transform: translateY(-2px);
}

.ep-btn.active {
    background: linear-gradient(135deg, var(--primary-dark), var(--primary));
    border-color: var(--primary);
    box-shadow: 0 4px 20px rgba(167, 139, 250, 0.4);
}

.server-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-bottom: 16px;
}

.server-tab {
    padding: 10px 20px;
    background: var(--glass);
    border: 1px solid var(--glass-border);
    border-radius: 10px;
    cursor: pointer;
    font-size: 0.9rem;
    transition: all 0.3s ease;
}

.server-tab:hover {
    background: rgba(167, 139, 250, 0.15);
    border-color: rgba(167, 139, 250, 0.4);
}

.server-tab.active {
    background: linear-gradient(135deg, rgba(124, 58, 237, 0.4), rgba(167, 139, 250, 0.3));
    border-color: var(--primary);
    color: #fff;
}

/* ===== Loading ===== */
.loading {
    text-align: center;
    padding: 60px 20px;
    color: rgba(255, 255, 255, 0.7);
}

.loading::after {
    content: '';
    display: inline-block;
    width: 40px;
    height: 40px;
    margin-top: 20px;
    border: 3px solid var(--glass-border);
    border-top-color: var(--primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

/* ===== Error ===== */
.error {
    padding: 20px;
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 12px;
    color: #fca5a5;
    margin: 20px 0;
    animation: shake 0.5s ease;
}

@keyframes shake {
    0%, 100% { transform: translateX(0); }
    20% { transform: translateX(-5px); }
    40% { transform: translateX(5px); }
    60% { transform: translateX(-5px); }
    80% { transform: translateX(5px); }
}

/* ===== Responsive ===== */
@media (max-width: 640px) {
    .detail-poster {
        width: 100%;
        max-width: 280px;
    }

    h1 {
        font-size: 1.5rem;
    }
}
`;

const XEM_PHIM_JS = `/* ===== Xem Phim - OPhim API App ===== */

const API_BASE = 'https://ophim1.com/v1/api';
const CDN_IMAGE = 'https://img.ophim.live/uploads/movies';

// Lấy chi tiết phim: ưu tiên proxy cùng origin (tránh CORS), fallback API trực tiếp + corsproxy
async function fetchPhimDetail(slug) {
    // Nếu mở từ worker/cùng domain → dùng proxy (không CORS)
    const proxyUrl = \`/api/ophim-phim?slug=\${encodeURIComponent(slug)}\`;
    try {
        const res = await fetch(proxyUrl);
        if (res.ok) return await res.json();
    } catch (_) { /* proxy không có, thử trực tiếp */ }
    try {
        const res = await fetch(\`\${API_BASE}/phim/\${slug}\`, { mode: 'cors' });
        if (res.ok) return await res.json();
    } catch (_) {}
    const corsProxy = 'https://corsproxy.io/?';
    const res = await fetch(corsProxy + encodeURIComponent(\`\${API_BASE}/phim/\${slug}\`));
    if (!res.ok) throw new Error('Không thể tải dữ liệu. Vui lòng mở qua trang chủ.');
    return await res.json();
}

function imageUrl(path) {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    return \`\${CDN_IMAGE}/\${path}\`;
}

// Placeholder khi ảnh lỗi
const IMG_PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 300'%3E%3Crect fill='%23333' width='200' height='300'/%3E%3Ctext x='100' y='150' fill='%23666' text-anchor='middle' dominant-baseline='middle' font-size='14'%3ENo image%3C/text%3E%3C/svg%3E";

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

async function showMovieDetail(slug) {
    const noSlugEl = document.getElementById('noSlug');
    const detailEl = document.getElementById('movieDetail');
    if (noSlugEl) noSlugEl.style.display = 'none';
    detailEl.classList.add('active');
    detailEl.style.display = 'block';
    const content = document.getElementById('detailContent');
    content.innerHTML = '<div class="loading">Đang tải thông tin phim...</div>';

    try {
        const data = await fetchPhimDetail(slug);
        if (data.status !== 'success' || !data.data?.item) {
            throw new Error('Không tìm thấy phim');
        }

        const movie = data.data.item;
        const episodes = movie.episodes || [];
        const firstEp = episodes[0]?.server_data?.[0];

        content.innerHTML = \`
            <div class="detail-header">
                <div class="poster-with-action">
                    <div class="detail-poster">
                        <img src="\${imageUrl(movie.poster_url || movie.thumb_url)}" alt="\${escapeHtml(movie.name)}"
                             onerror="this.src='\${IMG_PLACEHOLDER}'">
                    </div>
                    <button type="button" class="btn-xem-ngay" id="btnXemNgay">
                        <span class="btn-xem-icon">▶</span> Xem ngay
                    </button>
                </div>
                <div class="detail-info">
                    <h2>\${escapeHtml(movie.name)}</h2>
                    \${movie.origin_name ? \`<p style="color:rgba(255,255,255,0.7);margin-bottom:12px;">\${escapeHtml(movie.origin_name)}</p>\` : ''}
                    <div class="detail-meta">
                        <span>📅 \${movie.year || 'N/A'}</span>
                        <span>⏱ \${movie.time || ''}</span>
                        <span>📺 \${movie.episode_current || ''}</span>
                        <span>🎬 \${movie.quality || ''}</span>
                        <span>🌐 \${movie.lang || ''}</span>
                        \${movie.country?.length ? \`<span>📍 \${movie.country.map(c => c.name).join(', ')}</span>\` : ''}
                    </div>
                </div>
            </div>
            <div class="player-modal" id="playerModal">
                <div class="player-modal-backdrop" id="playerModalBackdrop"></div>
                <div class="player-modal-content">
                    <button type="button" class="player-modal-close" id="playerModalClose" aria-label="Đóng">×</button>
                    <div class="player-section">
                        <iframe id="playerFrame" src="\${firstEp?.link_embed || ''}" allowfullscreen></iframe>
                        \${episodes.length ? \`
                        <div class="player-controls">
                            <div class="player-controls-row">
                                <span class="player-controls-label">Server:</span>
                                <div class="server-tabs" id="serverTabs"></div>
                            </div>
                            <div class="player-controls-row">
                                <span class="player-controls-label">Tập:</span>
                                <div class="episodes" id="episodesList"></div>
                            </div>
                        </div>
                        \` : ''}
                    </div>
                </div>
            </div>
            \${movie.content ? \`
            <div class="content-block">
                <h3>Nội dung</h3>
                <p>\${movie.content.replace(/\n/g, '<br>')}</p>
            </div>
            \` : ''}
        \`;

        if (episodes.length) {
            const serverTabs = document.getElementById('serverTabs');
            const episodesList = document.getElementById('episodesList');

            episodes.forEach((server, i) => {
                const tab = document.createElement('div');
                tab.className = \`server-tab \${i === 0 ? 'active' : ''}\`;
                tab.textContent = server.server_name;
                tab.onclick = () => {
                    document.querySelectorAll('.server-tab').forEach((t, j) => t.classList.toggle('active', j === i));
                    renderEpisodes(episodes[i].server_data, episodesList);
                };
                serverTabs.appendChild(tab);
            });

            function renderEpisodes(serverData, el) {
                el.innerHTML = '';
                (serverData || []).forEach((ep, j) => {
                    const btn = document.createElement('button');
                    btn.className = \`ep-btn \${j === 0 ? 'active' : ''}\`;
                    btn.textContent = ep.name;
                    btn.onclick = () => {
                        document.querySelectorAll('.ep-btn').forEach(b => b.classList.remove('active'));
                        btn.classList.add('active');
                        document.getElementById('playerFrame').src = ep.link_embed || '';
                    };
                    el.appendChild(btn);
                });
            }

            renderEpisodes(episodes[0].server_data, episodesList);
        }

        const btnXemNgay = document.getElementById('btnXemNgay');
        const playerModal = document.getElementById('playerModal');
        const playerModalBackdrop = document.getElementById('playerModalBackdrop');
        const playerModalClose = document.getElementById('playerModalClose');
        if (btnXemNgay && playerModal) {
            btnXemNgay.addEventListener('click', () => {
                playerModal.classList.add('show');
                document.body.style.overflow = 'hidden';
            });
        }
        function closePlayerModal() {
            if (playerModal) {
                playerModal.classList.remove('show');
                document.body.style.overflow = '';
            }
        }
        if (playerModalBackdrop) playerModalBackdrop.addEventListener('click', closePlayerModal);
        if (playerModalClose) playerModalClose.addEventListener('click', closePlayerModal);
        document.addEventListener('keydown', function onEsc(e) {
            if (e.key === 'Escape' && playerModal?.classList.contains('show')) {
                closePlayerModal();
            }
        });
    } catch (err) {
        content.innerHTML = \`<div class="error">\${escapeHtml(err.message)}</div>\`;
    }
}

// Đọc slug từ URL (?slug=xxx) - dùng khi mở từ worker/trang khác
function getSlugFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('slug') || '';
}

// Event listeners
function init() {
    const slugFromUrl = getSlugFromUrl();
    if (slugFromUrl) {
        showMovieDetail(slugFromUrl);
    } else {
        document.getElementById('noSlug').style.display = 'block';
        document.getElementById('movieDetail').style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', init);
`;

function sr_b64_path(url) {
  const b = btoa(url).replace(/=+$/g, "");
  return encodeURIComponent(b);
}

function HTML_SYNC_SUB_PAGE(origin, token, userInfo) {
  const safeToken = token || "";

  // IMPORTANT: app se keo RAW -> luon gan raw=1
  const selfRawShadow = `${origin}/api/v1/client/subscribe?token=${encodeURIComponent(safeToken)}&flag=shadowrocket&raw=1`;
  const selfRawV2 = `${origin}/api/v1/client/subscribe?token=${encodeURIComponent(safeToken)}&flag=v2rayng&raw=1`;
  const selfRawV2Box = `${origin}/api/v1/client/subscribe?token=${encodeURIComponent(safeToken)}&flag=v2box&raw=1`;
  const selfRawIncy = `${origin}/api/v1/client/subscribe?token=${encodeURIComponent(safeToken)}&flag=incy&raw=1`;
  const selfRawClash = `${origin}/api/v1/client/subscribe?token=${encodeURIComponent(safeToken)}&flag=clashmeta&raw=1`;
  const selfRawSing = `${origin}/api/v1/client/subscribe?token=${encodeURIComponent(safeToken)}&flag=sing-box&raw=1`;
  const selfRawHapp = `${origin}/api/v1/client/subscribe?token=${encodeURIComponent(safeToken)}&flag=happ&raw=1`;
  const selfRawHiddify = `${origin}/api/v1/client/subscribe?token=${encodeURIComponent(safeToken)}&flag=hiddify&raw=1`;

  const shadowrocket_ok = `shadowrocket://add/sub://${sr_b64_path(selfRawShadow)}?remark=${encodeURIComponent(CONFIG.PROFILE_NAME)}`;
  const v2rayng_new = `v2rayng://install-sub/?url=${encodeURIComponent(selfRawV2)}%23${encodeURIComponent(CONFIG.PROFILE_NAME)}`;
  const v2box_link = `v2box://install-sub?url=${encodeURIComponent(selfRawV2Box)}&name=${encodeURIComponent(CONFIG.PROFILE_NAME)}`;
  const incy_install = `incy://import/${selfRawIncy}`;
  const hiddify_clash = `hiddify://import/${selfRawHiddify}#${encodeURIComponent(CONFIG.PROFILE_NAME)}`;
  const singbox = `sing-box://import-remote-profile?url=${encodeURIComponent(selfRawSing)}#${encodeURIComponent(CONFIG.PROFILE_NAME)}`;
  const clash_install = `clash://install-config?url=${encodeURIComponent(selfRawClash)}&name=${encodeURIComponent(CONFIG.PROFILE_NAME)}`;
  const karing_install = `karing://install-config?url=${encodeURIComponent(selfRawClash)}&name=${encodeURIComponent(CONFIG.PROFILE_NAME)}`;
  const happ_install = `happ://add/${(selfRawHapp)}`;

  const accountInfoHtml =
    userInfo && userInfo.success
      ? `<div class="card warn"><b>Thông tin tài khoản:</b>
  <div class="muted" style="margin-top:8px;display:grid;gap:6px">
    <div><b>ID:</b> ${escapeHtml(userInfo.id || "-")}</div>
    <div><b>Tên tài khoản:</b> ${escapeHtml(userInfo.email || "-")}</div>
    <div><b>Tên gói cước:</b> ${escapeHtml(userInfo.plan || "-")}</div>
    <div><b>Số GB đã dùng / Tổng GB:</b> ${escapeHtml(userInfo.used ?? "0")}GB / ${escapeHtml(userInfo.total ?? "0")}GB</div>
    <div><b>Hạn sử dụng:</b> ${escapeHtml(userInfo.expire || "-")}</div>
  </div>
</div>`
      : safeToken
        ? `<div class="card warn"><b>Thông tin tài khoản:</b>
  <div class="muted" style="margin-top:8px;color:#b91c1c">${escapeHtml(userInfo?.msg || "Không lấy được thông tin tài khoản.")}</div>
</div>`
        : "";

  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>${escapeHtml(CONFIG.PROFILE_NAME)} - Đồng Bộ</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;max-width:960px;margin:24px auto;padding:0 14px;background:#f5f7fa}
.card{background:#fff;border:1px solid #e0e4e8;border-radius:12px;padding:16px;margin:12px 0;box-shadow:0 1px 3px #0005}
.row{display:flex;gap:10px;flex-wrap:wrap}
a.btn{display:inline-block;padding:12px 16px;border-radius:8px;border:1px solid #ddd;background:#fff;text-decoration:none;color:#333;font-weight:600;transition:.2s}
a.btn:hover{background:#f0f0f0;border-color:#999}
a.btn.primary{background:#0066ff;color:#fff;border-color:#0066ff}
a.btn.primary:hover{background:#0052cc;box-shadow:0 2px 8px #0066ff40}
.muted{color:#666;font-size:14px;line-height:1.6}
.warn{background:#fff7e6;border:1px solid #ffc069;border-radius:8px;padding:12px}
h2{margin:0 0 16px 0;color:#000}
h3{margin:0 0 12px 0;color:#000;font-size:18px}
.ophim-search-card{overflow:hidden;position:relative;border:none;background:linear-gradient(145deg,#ffffff 0%,#f8faff 50%,#fff 100%);box-shadow:0 4px 24px rgba(15,23,42,.06),0 1px 3px rgba(0,0,0,.04)}
.ophim-search-card::before{content:"";position:absolute;inset:0 0 auto 0;height:3px;background:linear-gradient(90deg,#0066ff,#00c6ff,#7c3aed);opacity:.9}
.ophim-search-head{margin-bottom:14px}
.ophim-search-badge{display:inline-block;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#0066ff;background:linear-gradient(135deg,rgba(0,102,255,.12),rgba(124,58,237,.1));padding:4px 10px;border-radius:999px;margin-bottom:8px;border:1px solid rgba(0,102,255,.2)}
.ophim-search-head h3{margin:0 0 6px 0;font-size:1.25rem;background:linear-gradient(90deg,#0f172a,#334155);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.ophim-search-sub{margin:0;font-size:13px;color:#64748b;line-height:1.5}
.ophim-search-row{display:flex;gap:12px;flex-wrap:wrap;align-items:stretch;margin-top:4px}
.ophim-input-wrap{flex:1;min-width:200px;position:relative;display:flex;align-items:center}
.ophim-input-icon{position:absolute;left:14px;font-size:15px;opacity:.55;pointer-events:none;z-index:1;transition:transform .25s ease,opacity .25s}
.ophim-input-wrap:focus-within .ophim-input-icon{opacity:.85;transform:scale(1.08)}
.search-input{width:100%;min-width:0;padding:14px 14px 14px 42px;border-radius:14px;border:1.5px solid #e2e8f0;background:rgba(255,255,255,.95);outline:none;font-size:15px;transition:border-color .25s,box-shadow .25s,background .25s}
.search-input::placeholder{color:#94a3b8}
.search-input:hover{border-color:#cbd5e1;background:#fff}
.search-input:focus{border-color:#0066ff;box-shadow:0 0 0 4px rgba(0,102,255,.15),0 8px 24px rgba(0,102,255,.12)}
.search-btn{align-self:stretch;padding:0 22px;border-radius:14px;border:none;background:linear-gradient(135deg,#0066ff 0%,#0052cc 45%,#0047b3 100%);color:#fff;font-weight:800;font-size:15px;cursor:pointer;box-shadow:0 4px 14px rgba(0,102,255,.35);transition:transform .2s,box-shadow .2s,filter .2s;position:relative;overflow:hidden}
.search-btn::after{content:"";position:absolute;inset:0;background:linear-gradient(120deg,transparent 30%,rgba(255,255,255,.25) 50%,transparent 70%);transform:translateX(-100%);transition:transform .6s ease}
.search-btn:hover{transform:translateY(-2px);box-shadow:0 8px 22px rgba(0,102,255,.4);filter:brightness(1.03)}
.search-btn:hover::after{transform:translateX(100%)}
.search-btn:active{transform:translateY(0);box-shadow:0 3px 12px rgba(0,102,255,.35)}
.search-btn span{position:relative;z-index:1}
#ophimSearchStatus{min-height:22px;transition:opacity .3s}
#ophimSearchStatus.ophim-status-pulse{animation:ophimPulse 1.2s ease-in-out infinite}
@keyframes ophimPulse{0%,100%{opacity:.65}50%{opacity:1}}
.ophim-results{display:flex;flex-wrap:wrap;gap:14px;margin-top:14px;min-height:8px}
.ophim-results.loading{pointer-events:none;opacity:.85}
.ophim-result{width:calc(33.333% - 10px);min-width:200px;background:#fff;border:1px solid #e8ecf1;border-radius:14px;overflow:hidden;box-shadow:0 2px 8px rgba(15,23,42,.06);transition:transform .3s cubic-bezier(.34,1.56,.64,1),box-shadow .3s,border-color .3s;animation:ophimCardIn .5s cubic-bezier(.22,1,.36,1) backwards}
.ophim-result:hover{transform:translateY(-4px);box-shadow:0 12px 28px rgba(15,23,42,.12);border-color:rgba(0,102,255,.35)}
.ophim-result-thumb{position:relative;overflow:hidden;aspect-ratio:2/3;background:linear-gradient(160deg,#e2e8f0,#f1f5f9)}
.ophim-result img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .45s cubic-bezier(.34,1.56,.64,1)}
.ophim-result:hover img{transform:scale(1.06)}
.ophim-result-overlay{position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.7) 0%,transparent 45%);display:flex;align-items:flex-end;justify-content:center;padding:14px}
.ophim-btn-xem{display:inline-flex;align-items:center;gap:6px;padding:10px 20px;background:linear-gradient(135deg,#0066ff,#0052cc);color:#fff;font-size:14px;font-weight:700;text-decoration:none;border-radius:999px;box-shadow:0 4px 16px rgba(0,102,255,.4);transition:transform .2s,box-shadow .2s}
.ophim-btn-xem:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(0,102,255,.5);color:#fff}
.ophim-btn-icon{font-size:12px;opacity:.95}
.ophim-result-title{display:block;padding:12px 14px;text-decoration:none;color:#0f172a;font-size:13px;font-weight:800;line-height:1.35;transition:color .2s}
.ophim-result:hover .ophim-result-title{color:#0066ff}
@keyframes ophimCardIn{from{opacity:0;transform:translateY(14px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}
@media (max-width:650px){.ophim-result{width:calc(50% - 7px);min-width:0}}
@media (prefers-reduced-motion:reduce){.ophim-result,.ophim-btn-xem,.search-btn,.ophim-input-icon,.ophim-result img{transition:none}.ophim-result{animation:none}#ophimSearchStatus.ophim-status-pulse{animation:none}}
</style>
</head>
<body>

<h2>${escapeHtml(CONFIG.PROFILE_NAME)} – Chọn app để đồng bộ</h2>

<div class="card warn"><b>Lưu ý:</b>
  <div class="muted">
    Trang chủ Website đã đổi thành: <a href="https://vpn.shoptuantruong.com" style="color:#1E90FF; font-weight:bold;">
VPN.SHOPTUANTRUONG.COM
</a><br>
    Nếu bấm nút mà không mở/import: hãy thử lại bằng Safari/Chrome.<br>
    Với Clash Android/Clash Meta Android: nếu deeplink không hoạt động, hãy thử bấm lại liên kết bằng trình duyệt mặc định hoặc Chrome.
  </div>
</div>


${accountInfoHtml}
<div class="card ophim-search-card">
  <div class="ophim-search-head">
    <h3>Xem Phim Nhanh</h3>
    <p class="ophim-search-sub">Dành cho ai nghiền xem phim, tất cả các bộ phim đều có ở đây <br>Chỉ cần gõ tên phim, nhấn <b>Tìm</b> — kết quả hiện ngay bên dưới.</p>
  </div>
  <div class="ophim-search-row">
    <div class="ophim-input-wrap">
      <span class="ophim-input-icon" aria-hidden="true">🔎</span>
      <input
        id="ophimSearchInput"
        class="search-input"
        type="text"
        placeholder="Ví dụ: Doraemon"
        autocomplete="off"
        onkeydown="if(event.key==='Enter'){doOphimSearch();}"
      />
    </div>
    <button type="button" class="search-btn" onclick="doOphimSearch()"><span>Tìm</span></button>
  </div>
  <div id="ophimSearchStatus" class="muted" style="margin-top:12px;display:none;"></div>
  <div id="ophimSearchResults" class="ophim-results"></div>
</div>
<div class="card">
  <h3>Đồng bộ nhanh</h3>
  <div class="row">
    <a class="btn primary" href="${escapeHtml(shadowrocket_ok)}">Shadowrocket</a>
    <a class="btn primary" href="${escapeHtml(happ_install)}">Happ</a>
    <a class="btn" href="${escapeHtml(incy_install)}">INCY</a>
    <a class="btn" href="${escapeHtml(v2rayng_new)}">v2rayNG</a>
    <a class="btn" href="${escapeHtml(v2box_link)}">V2Box</a>
    <a class="btn" href="${escapeHtml(singbox)}">sing-box</a>
    <a class="btn" href="${escapeHtml(hiddify_clash)}">Hiddify</a>
    <a class="btn" href="${escapeHtml(clash_install)}">Clash for Android</a>
    <a class="btn" href="${escapeHtml(clash_install)}">Clash Meta</a>
    <a class="btn" href="${escapeHtml(karing_install)}">Karing</a>
  </div>
</div>

<script>
const XEM_PHIM_BASE = "${escapeHtml(CONFIG.XEM_PHIM_BASE || "")}";
let ophimAbortCtrl = null;
function escapeHtmlClient(s) {
  return (s || "")
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
async function doOphimSearch() {
  const inputEl = document.getElementById("ophimSearchInput");
  const statusEl = document.getElementById("ophimSearchStatus");
  const resultsEl = document.getElementById("ophimSearchResults");
  if (!inputEl || !statusEl || !resultsEl) return;

  const q = (inputEl.value || "").trim();
  if (!q) {
    resultsEl.innerHTML = "";
    resultsEl.classList.remove("loading");
    statusEl.classList.remove("ophim-status-pulse");
    statusEl.style.display = "none";
    return;
  }

  statusEl.style.display = "block";
  statusEl.textContent = "Đang tìm…";
  statusEl.classList.add("ophim-status-pulse");
  resultsEl.innerHTML = "";
  resultsEl.classList.add("loading");

  try {
    if (ophimAbortCtrl) ophimAbortCtrl.abort();
    ophimAbortCtrl = new AbortController();

    const resp = await fetch("/api/ophim-search?q=" + encodeURIComponent(q), {
      method: "GET",
      signal: ophimAbortCtrl.signal,
    });

    const json = await resp.json().catch(() => null);
    const items = json && json.data && Array.isArray(json.data.items) ? json.data.items : [];

    if (!resp.ok || items.length === 0) {
      statusEl.textContent = "Không có kết quả.";
      statusEl.style.display = "block";
      statusEl.classList.remove("ophim-status-pulse");
      resultsEl.innerHTML = "";
      resultsEl.classList.remove("loading");
      return;
    }

    statusEl.style.display = "none";
    statusEl.classList.remove("ophim-status-pulse");
    resultsEl.classList.remove("loading");
    const baseImg = "https://img.ophim.live/uploads/movies/";
    const xemPhimBase = (typeof XEM_PHIM_BASE !== "undefined" && XEM_PHIM_BASE) ? (XEM_PHIM_BASE + (XEM_PHIM_BASE.includes("?") ? "&" : "?") + "slug=") : (window.location.origin + "/xem-phim?slug=");

    resultsEl.innerHTML = items.map((it, i) => {
      const slug = it && it.slug ? String(it.slug) : "";
      const name = it && it.name ? String(it.name) : slug;
      const thumbUrl = it && it.thumb_url ? String(it.thumb_url) : "";
      const fullThumb = thumbUrl
        ? thumbUrl.startsWith("http")
          ? thumbUrl
          : baseImg + thumbUrl
        : "";

      const href = slug ? xemPhimBase + encodeURIComponent(slug) : "#";
      const imgHtml = fullThumb
        ? '<img loading="lazy" src="' + fullThumb + '" alt="' + escapeHtmlClient(name) + '">'
        : "";
      const delay = (i * 0.055).toFixed(3) + "s";

      return (
        '<div class="ophim-result" style="animation-delay:' + delay + '">' +
        '<div class="ophim-result-thumb">' +
        imgHtml +
        '<div class="ophim-result-overlay">' +
        '<a href="' + href + '" target="_blank" rel="noopener noreferrer" class="ophim-btn-xem"><span class="ophim-btn-icon">▶</span> Xem ngay</a>' +
        "</div></div>" +
        '<a href="' + href + '" target="_blank" rel="noopener noreferrer" class="ophim-result-title">' + escapeHtmlClient(name) + "</a>" +
        "</div>"
      );
    }).join("");
  } catch (e) {
    if (e && e.name === "AbortError") return;
    statusEl.textContent = "Lỗi tìm kiếm.";
    statusEl.style.display = "block";
    statusEl.classList.remove("ophim-status-pulse");
    resultsEl.innerHTML = "";
    resultsEl.classList.remove("loading");
  }
}
</script>

</body>
</html>`;
}

