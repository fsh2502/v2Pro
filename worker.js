
const CONFIG = {
  V2BOARD_DOMAIN: "",
  TG_BOT_TOKEN: "",
  ADMIN_CHAT_ID: "",
  DEFAULT_LIMIT: 2,
  ERROR_MSG: "QUA THIET BI - LIEN HE SHOPTUANTRUONG",
  PROFILE_NAME: "",
  SUPPORT_URL: "",
  ALERT_COOLDOWN: 1 * 60 * 60 * 1000,
  ADMIN_PASSWORD: ".",
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

function parseTrafficGb(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const normalized = String(value ?? "").trim().replace(/,/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function getUserInfo(token) {
  try {
    const apiRes = await fetch(`https://${CONFIG.V2BOARD_DOMAIN}/check_user.php?token=${encodeURIComponent(token)}`);
    if (apiRes.ok) {
      const userInfo = await apiRes.json();
      if (userInfo.success && userInfo.email) {
        userInfo.used = parseTrafficGb(userInfo.used);
        userInfo.total = parseTrafficGb(userInfo.total);
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
  const subscriptionPageUrl = new URL(`${originalUrl.origin}${cleanPathname}`);
  const subscriptionToken = originalUrl.searchParams.get("token");
  if (subscriptionToken) subscriptionPageUrl.searchParams.set("token", subscriptionToken);

  const newHeaders = new Headers(request.headers);
  newHeaders.set("Host", CONFIG.V2BOARD_DOMAIN);

  try {
    const response = await fetch(targetUrl, { method: request.method, headers: newHeaders });

    const resHeaders = new Headers(response.headers);
    if (!resHeaders.get("profile-title")) {
      resHeaders.set("profile-title", CONFIG.PROFILE_NAME);
    }
    resHeaders.set("profile-update-interval", "2");
    resHeaders.set("support-url", CONFIG.SUPPORT_URL);
    resHeaders.set("profile-web-page-url", subscriptionPageUrl.toString());

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

function HTML_SYNC_SUB_PAGE(origin, token, userInfo) {
  const safeToken = token || "";
  const accountReady = !!(userInfo && userInfo.success);
  const used = accountReady && Number.isFinite(Number(userInfo.used)) ? Math.max(0, Number(userInfo.used)) : 0;
  const total = accountReady && Number.isFinite(Number(userInfo.total)) ? Math.max(0, Number(userInfo.total)) : 0;
  const usagePercent = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const expiryText = accountReady ? String(userInfo.expire || "-") : "-";

  function parseExpiry(value) {
    if (value === null || value === undefined || value === "") return null;
    const text = String(value).trim();
    if (/^\d+$/.test(text)) {
      const numeric = Number(text);
      return numeric > 1000000000000 ? numeric : numeric * 1000;
    }
    const dayFirst = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if (dayFirst) return new Date(Number(dayFirst[3]), Number(dayFirst[2]) - 1, Number(dayFirst[1]), 23, 59, 59).getTime();
    const parsed = Date.parse(text);
    return Number.isNaN(parsed) ? null : parsed;
  }

  const expiryTime = accountReady ? parseExpiry(userInfo.expire) : null;
  const daysLeft = expiryTime === null ? null : Math.ceil((expiryTime - Date.now()) / 86400000);
  let statusLabel = accountReady ? "Tài khoản đang hoạt động" : "Chưa xác định tài khoản";
  let statusTone = accountReady ? "success" : "neutral";
  let alertText = "Gói của bạn đang hoạt động bình thường. Hãy gia hạn sớm để tránh gián đoạn kết nối.";

  if (!safeToken) {
    statusLabel = "Thiếu mã đăng ký";
    statusTone = "danger";
    alertText = "Liên kết hiện tại chưa có mã đăng ký. Vui lòng mở lại liên kết được cung cấp cho tài khoản của bạn.";
  } else if (!accountReady) {
    statusLabel = "Không tải được tài khoản";
    statusTone = "danger";
    alertText = userInfo?.msg || "Không lấy được thông tin tài khoản. Vui lòng thử lại hoặc liên hệ hỗ trợ.";
  } else if (daysLeft !== null && daysLeft < 0) {
    statusLabel = "Tài khoản đã hết hạn";
    statusTone = "danger";
    alertText = "Gói dịch vụ đã hết hạn. Vui lòng gia hạn để tiếp tục kết nối.";
  } else if (total > 0 && used >= total) {
    statusLabel = "Đã hết dung lượng";
    statusTone = "danger";
    alertText = "Dung lượng của gói đã được sử dụng hết. Vui lòng gia hạn hoặc nâng cấp gói dịch vụ.";
  } else if ((daysLeft !== null && daysLeft <= 7) || usagePercent >= 90) {
    statusLabel = "Tài khoản sắp cần gia hạn";
    statusTone = "warning";
    alertText = daysLeft !== null && daysLeft <= 7
      ? `Gói của bạn chỉ còn ${Math.max(0, daysLeft)} ngày sử dụng. Hãy gia hạn để tránh gián đoạn kết nối.`
      : `Bạn đã sử dụng ${usagePercent}% dung lượng. Hãy kiểm tra gói dịch vụ để tránh gián đoạn kết nối.`;
  }

  const daysLeftText = daysLeft === null ? "Chưa xác định" : daysLeft < 0 ? "Đã hết hạn" : `Còn ${daysLeft} ngày`;
  const subscriptionLink = `${origin}/api/v1/client/subscribe?token=${encodeURIComponent(safeToken)}`;
  const manageUrl = `/manage?token=${encodeURIComponent(safeToken)}`;
  const supportUrl = CONFIG.SUPPORT_URL || "https://vpn.shoptuantruong.com";
  const accountName = accountReady ? String(userInfo.email || userInfo.id || "Tài khoản VPN") : "Tài khoản VPN";
  const copyAction = safeToken
    ? `<button type="button" class="action action-blue" onclick="copySubscription()"><span class="action-icon">⧉</span><span>Sao chép link đăng ký</span><span class="action-arrow">›</span></button>`
    : `<button type="button" class="action action-blue" disabled><span class="action-icon">⧉</span><span>Sao chép link đăng ký</span><span class="action-arrow">›</span></button>`;
  const manageAction = safeToken
    ? `<a class="action action-purple" href="${escapeHtml(manageUrl)}"><span class="action-icon">▣</span><span>Quản lý thiết bị</span><span class="action-arrow">›</span></a>`
    : `<span class="action action-purple disabled"><span class="action-icon">▣</span><span>Quản lý thiết bị</span><span class="action-arrow">›</span></span>`;

  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>${escapeHtml(CONFIG.PROFILE_NAME)} - Quản lý tài khoản VPN</title>
<style>
*{box-sizing:border-box}
:root{color-scheme:light;--bg:#f4f7fb;--card:#fff;--text:#102044;--muted:#65728d;--line:#e7edf6;--blue:#1677ff;--purple:#7447eb;--green:#12aa62;--amber:#f59e0b;--red:#e5484d}
body{margin:0;background:radial-gradient(circle at 50% -10%,#eaf3ff 0,transparent 32%),var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif}
button,a{font:inherit}
.page{width:min(1160px,calc(100% - 28px));margin:0 auto;padding:30px 0 42px}
.hero{text-align:center;margin-bottom:20px}
.brand{display:inline-flex;align-items:center;gap:13px;text-align:left}
.logo{display:grid;place-items:center;width:54px;height:54px;border-radius:17px;background:linear-gradient(145deg,#2693ff,#1469ed);box-shadow:0 12px 30px #1677ff35;color:#fff}
.logo svg{width:31px;height:31px}
.brand h1{font-size:clamp(24px,3vw,34px);line-height:1;margin:0 0 6px;letter-spacing:-.035em}
.brand p{margin:0;color:var(--muted);font-weight:600}
.status-pill{display:inline-flex;align-items:center;gap:8px;margin-top:13px;padding:7px 13px;border-radius:999px;font-size:13px;font-weight:800;border:1px solid}
.status-pill::before{content:"";width:9px;height:9px;border-radius:50%;background:currentColor}
.status-pill.success{color:#078a4b;background:#eafaf1;border-color:#9ee2bd}
.status-pill.warning{color:#a96500;background:#fff7df;border-color:#f7ce79}
.status-pill.danger{color:#bf3038;background:#fff0f1;border-color:#f3a7ac}
.status-pill.neutral{color:#667085;background:#f6f7f9;border-color:#d7dce5}
.card{background:var(--card);border:1px solid rgba(221,229,240,.85);border-radius:18px;box-shadow:0 12px 34px rgba(33,62,105,.08)}
.summary{display:grid;grid-template-columns:repeat(3,1fr);padding:20px 10px;margin-bottom:14px}
.metric{display:grid;grid-template-columns:54px 1fr;gap:15px;align-items:center;padding:6px 28px;min-width:0}
.metric+.metric{border-left:1px solid var(--line)}
.metric-icon{display:grid;place-items:center;width:50px;height:50px;border-radius:50%;font-size:24px;font-weight:900;background:#edf5ff;color:var(--blue)}
.metric:nth-child(2) .metric-icon{background:#f4efff;color:var(--purple)}
.metric:nth-child(3) .metric-icon{background:#fff5e7;color:var(--amber)}
.metric-label{font-size:14px;color:var(--muted);margin-bottom:5px}
.metric-value{font-size:clamp(18px,2vw,23px);font-weight:850;line-height:1.2;overflow-wrap:anywhere}
.metric-note{margin-top:7px;color:var(--muted);font-size:12px;font-weight:650}
.metric-note.good{color:#069653;font-size:14px}
.progress{height:8px;background:#e9eef5;border-radius:99px;overflow:hidden;margin-top:9px}
.progress span{display:block;height:100%;width:${usagePercent}%;background:linear-gradient(90deg,#258cff,#1677ff);border-radius:inherit}
.notice{display:flex;align-items:center;gap:16px;margin:14px 0;padding:17px 22px;border-radius:16px;background:#fff8e8;border:1px solid #f5bd45;color:#6f4810}
.notice.danger{background:#fff1f2;border-color:#f2a1a6;color:#8f252b}
.notice-icon{display:grid;place-items:center;flex:0 0 38px;width:38px;height:38px;border-radius:12px;background:#ffedc2;color:#e98300;font-size:21px;font-weight:900}
.notice.danger .notice-icon{background:#ffdfe1;color:var(--red)}
.notice b{display:block;margin-bottom:3px}.notice p{margin:0;font-size:14px;line-height:1.5}
.dashboard{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(300px,.9fr);gap:14px;margin-top:14px}
.section{padding:20px}
.section h2{font-size:19px;margin:0 0 15px;letter-spacing:-.015em}
.actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px}
.action{appearance:none;border:0;display:grid;grid-template-columns:34px 1fr 20px;align-items:center;gap:10px;min-height:76px;padding:14px 18px;border-radius:14px;color:#fff;text-decoration:none;text-align:left;font-weight:800;cursor:pointer;box-shadow:0 9px 22px rgba(31,104,229,.16);transition:transform .18s ease,filter .18s ease}
.action:hover{transform:translateY(-2px);filter:brightness(1.04)}
.action:focus-visible{outline:3px solid #93c5fd;outline-offset:3px}
.action:disabled,.action.disabled{opacity:.48;cursor:not-allowed;transform:none}
.action-blue{background:linear-gradient(135deg,#1687ff,#126be6)}
.action-purple{background:linear-gradient(135deg,#8158ef,#6939db)}
.action-green{background:linear-gradient(135deg,#18bc70,#0da45d)}
.action-sky{background:linear-gradient(135deg,#3f93f9,#2677e7)}
.action-icon{font-size:27px;font-weight:500}.action-arrow{font-size:28px;text-align:right;font-weight:400}
.side{display:grid;gap:14px}
.health-list{display:grid;gap:13px}
.health-row{display:grid;grid-template-columns:12px 1fr auto;align-items:center;gap:10px;font-size:14px}
.dot{width:10px;height:10px;border-radius:50%;background:var(--green);box-shadow:0 0 0 4px #e7f8ef}
.dot.warning{background:var(--amber);box-shadow:0 0 0 4px #fff3d8}
.dot.danger,.dot.neutral{background:var(--red);box-shadow:0 0 0 4px #ffe6e8}
.health-value{color:#079250;font-weight:800;text-align:right}
.security{display:flex;gap:12px;padding:12px;border-radius:12px;background:#f4f0ff;color:#4f3b88;font-size:13px;line-height:1.5}
.security strong{font-size:18px;color:var(--purple)}
.faq{padding:18px 20px;margin-top:14px}
.faq h2{font-size:19px;margin:0 0 12px}
details{border-top:1px solid var(--line)}
details:last-child{border-bottom:1px solid var(--line)}
summary{cursor:pointer;list-style:none;padding:14px 2px;font-weight:700;font-size:14px;display:flex;justify-content:space-between;gap:15px}
summary::-webkit-details-marker{display:none}
summary::after{content:"⌄";color:var(--blue);font-size:18px;transition:transform .18s}
details[open] summary::after{transform:rotate(180deg)}
details p{margin:0;padding:0 2px 15px;color:var(--muted);font-size:14px;line-height:1.55}
.support{display:flex;align-items:center;justify-content:center;gap:9px;margin-top:14px;padding:16px;border-radius:15px;background:#eaf2fd;color:#2a4d83;text-decoration:none;font-weight:800}
.support:hover{background:#dfeafb}
.toast{position:fixed;left:50%;bottom:24px;transform:translate(-50%,20px);padding:12px 18px;border-radius:12px;background:#102044;color:#fff;font-weight:750;box-shadow:0 15px 40px #10204445;opacity:0;pointer-events:none;transition:.22s;z-index:30}
.toast.show{opacity:1;transform:translate(-50%,0)}
.footer{text-align:center;color:#8792a8;font-size:12px;margin-top:18px}
@media(max-width:820px){.summary{grid-template-columns:1fr}.metric{padding:14px 18px}.metric+.metric{border-left:0;border-top:1px solid var(--line)}.dashboard{grid-template-columns:1fr}}
@media(max-width:560px){.page{width:min(100% - 20px,1160px);padding-top:20px}.brand{align-items:center}.logo{width:48px;height:48px}.brand p{font-size:13px}.summary{padding:7px}.metric{grid-template-columns:44px 1fr;gap:12px}.metric-icon{width:42px;height:42px;font-size:20px}.actions{grid-template-columns:1fr}.section{padding:16px}.notice{align-items:flex-start;padding:15px}.health-row{grid-template-columns:12px 1fr}.health-value{grid-column:2;text-align:left}.support{text-align:center;font-size:14px}}
@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important}}
</style>
</head>
<body>
<main class="page">
  <header class="hero">
    <div class="brand">
      <span class="logo" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M12 3 19 6v5c0 4.7-2.9 8.4-7 10-4.1-1.6-7-5.3-7-10V6l7-3Z" stroke="currentColor" stroke-width="2"/><path d="m8.8 12 2.1 2.1 4.5-4.6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
      <span><h1>${escapeHtml(CONFIG.PROFILE_NAME)}</h1><p>Quản lý tài khoản VPN</p></span>
    </div>
    <div><span class="status-pill ${statusTone}">${escapeHtml(statusLabel)}</span></div>
  </header>

  <section class="card summary" aria-label="Thông tin tài khoản">
    <div class="metric">
      <span class="metric-icon" aria-hidden="true">▤</span>
      <div><div class="metric-label">Dung lượng</div><div class="metric-value">${escapeHtml(used)} GB / ${escapeHtml(total)} GB</div><div class="progress"><span></span></div><div class="metric-note">Đã sử dụng ${usagePercent}%</div></div>
    </div>
    <div class="metric">
      <span class="metric-icon" aria-hidden="true">□</span>
      <div><div class="metric-label">Ngày hết hạn</div><div class="metric-value">${escapeHtml(expiryText)}</div><div class="metric-note good">${escapeHtml(daysLeftText)}</div></div>
    </div>
    <div class="metric">
      <span class="metric-icon" aria-hidden="true">♛</span>
      <div><div class="metric-label">Gói dịch vụ</div><div class="metric-value">${escapeHtml(accountReady ? userInfo.plan || "-" : "-")}</div><div class="metric-note">${escapeHtml(accountName)}</div></div>
    </div>
  </section>

  <section class="notice ${statusTone === "danger" ? "danger" : ""}" role="status">
    <span class="notice-icon" aria-hidden="true">!</span><div><b>Lưu ý</b><p>${escapeHtml(alertText)}</p></div>
  </section>

  <div class="dashboard">
    <section class="card section">
      <h2>Thao tác nhanh</h2>
      <div class="actions">
        ${copyAction}
        ${manageAction}
        <a class="action action-green" href="${escapeHtml(supportUrl)}" target="_blank" rel="noopener noreferrer"><span class="action-icon">▦</span><span>Gia hạn dịch vụ</span><span class="action-arrow">›</span></a>
        <a class="action action-sky" href="${escapeHtml(supportUrl)}" target="_blank" rel="noopener noreferrer"><span class="action-icon">◉</span><span>Liên hệ hỗ trợ</span><span class="action-arrow">›</span></a>
      </div>
    </section>

    <aside class="side">
      <section class="card section">
        <h2>Trạng thái dịch vụ</h2>
        <div class="health-list">
          <div class="health-row"><span class="dot ${accountReady ? "" : "danger"}"></span><span>Dữ liệu tài khoản</span><span class="health-value">${accountReady ? "Đã cập nhật" : "Chưa xác định"}</span></div>
          <div class="health-row"><span class="dot ${statusTone === "success" ? "" : statusTone}"></span><span>Trạng thái gói</span><span class="health-value">${escapeHtml(statusLabel)}</span></div>
          <div class="health-row"><span class="dot"></span><span>Cập nhật gần nhất</span><span class="health-value">Vừa cập nhật</span></div>
        </div>
      </section>
      <section class="card section">
        <h2>Bảo vệ tài khoản</h2>
        <div class="security"><strong>◆</strong><span>Không chia sẻ link đăng ký với người khác. Hãy liên hệ hỗ trợ nếu nghi ngờ link đã bị lộ.</span></div>
      </section>
    </aside>
  </div>
  <section class="card faq">
    <h2>Hướng dẫn thường gặp</h2>
    <details><summary>Làm gì khi không có mạng?</summary><p>Hãy cập nhật lại đăng ký, đổi sang máy chủ khác và kiểm tra kết nối Internet gốc. Nếu vẫn lỗi, gửi ảnh thông báo cho bộ phận hỗ trợ.</p></details>
    <details><summary>Cách đổi sang thiết bị mới</summary><p>Mở Quản lý thiết bị, xóa thiết bị cũ không còn sử dụng rồi nhập lại link đăng ký trên thiết bị mới.</p></details>
    <details><summary>Khi nào cần cập nhật đăng ký?</summary><p>Hãy cập nhật sau khi gia hạn, khi danh sách máy chủ thay đổi hoặc khi bộ phận hỗ trợ yêu cầu.</p></details>
  </section>

  <a class="support" href="${escapeHtml(supportUrl)}" target="_blank" rel="noopener noreferrer">◉ Cần trợ giúp? Đội ngũ hỗ trợ luôn sẵn sàng. ›</a>
  <footer class="footer">${escapeHtml(CONFIG.PROFILE_NAME)} · Quản lý tài khoản VPN · An toàn kết nối</footer>
</main>
<div id="copyToast" class="toast" role="status" aria-live="polite">Đã sao chép link đăng ký!</div>
<script>
const subscriptionLink = ${JSON.stringify(subscriptionLink)};
async function copySubscription() {
  let copied = false;
  try {
    await navigator.clipboard.writeText(subscriptionLink);
    copied = true;
  } catch (_) {
    const input = document.createElement("textarea");
    input.value = subscriptionLink;
    input.setAttribute("readonly", "");
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.appendChild(input);
    input.select();
    copied = document.execCommand("copy");
    input.remove();
  }
  const toast = document.getElementById("copyToast");
  toast.textContent = copied ? "Đã sao chép link đăng ký!" : "Không thể sao chép. Vui lòng thử lại.";
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2200);
}
</script>
</body>
</html>`;
}

