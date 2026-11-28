import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const sha = async (value: string) =>
  Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))))
    .map((b) => b.toString(16).padStart(2, "0")).join("");

const esc = (value: unknown) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]!));

const localParts = (timezone: string) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}`,
  };
};

const APP = "https://payables-tracker-ketan-soni.vercel.app";
const SMS_REVIEW_URL = `${APP}/sms-capture.html#review`;
const CASHBOOK_URL = `${APP}/cashbook.html`;

const emailHtml = (smsCount: number, particularsCount: number, rows: any[], date: string) => {
  const total = smsCount + particularsCount;
  const allClear = total === 0;
  const cards = rows.map((row: any) => {
    const direction = row.parsed_direction === "out" ? "Debit" : row.parsed_direction === "in" ? "Credit" : "Needs checking";
    const amount = Number(row.parsed_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `<tr><td style="padding:0 0 10px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:10px;background:#fff"><tr><td style="padding:12px 14px 3px;font-size:12px;color:#64748b">${esc(row.parsed_date || "Date unavailable")} · ${direction}</td></tr><tr><td style="padding:0 14px 3px;font-size:19px;font-weight:bold;color:#111827">₹${esc(amount)}</td></tr><tr><td style="padding:0 14px 12px;font-size:13px;line-height:19px;color:#334155">${esc(row.parsed_description || "Bank transaction")}</td></tr></table></td></tr>`;
  }).join("");
  const smsAction = smsCount
    ? `<a href="${SMS_REVIEW_URL}" style="display:inline-block;background:#155eef;color:#fff;text-decoration:none;font-size:14px;font-weight:bold;padding:11px 15px;border-radius:8px;margin:4px 6px 4px 0">Review SMS messages</a>`
    : "";
  const particularsAction = particularsCount
    ? `<a href="${CASHBOOK_URL}" style="display:inline-block;background:#155eef;color:#fff;text-decoration:none;font-size:14px;font-weight:bold;padding:11px 15px;border-radius:8px;margin:4px 6px 4px 0">Review Cash Book particulars</a>`
    : "";
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f3f5f9;font-family:Arial,Helvetica,sans-serif;color:#172033"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f5f9"><tr><td align="center" style="padding:18px 10px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px"><tr><td style="padding:0 4px 12px;font-size:13px;font-weight:bold;color:#334155">PAYABLES TRACKER</td></tr><tr><td style="background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:22px 16px"><div style="font-size:12px;font-weight:bold;color:${allClear ? "#047857" : "#9a3412"};padding-bottom:8px">${allClear ? "ALL CLEAR" : "DAILY ACTION SUMMARY"}</div><div style="font-size:23px;line-height:29px;font-weight:bold;color:#111827">${allClear ? "You’re all caught up" : "Your items need attention"}</div><p style="font-size:13px;color:#64748b;margin:7px 0 16px">${esc(date)} · Daily Payables Tracker reminder</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr><td style="padding:12px 10px;border:1px solid #e2e8f0;font-size:14px;color:#334155">Pending SMS message review</td><td align="right" style="padding:12px 10px;border:1px solid #e2e8f0;font-size:18px;font-weight:bold;color:#111827">${smsCount}</td></tr><tr><td style="padding:12px 10px;border:1px solid #e2e8f0;font-size:14px;color:#334155">Posted Cash Book transactions missing particulars</td><td align="right" style="padding:12px 10px;border:1px solid #e2e8f0;font-size:18px;font-weight:bold;color:#111827">${particularsCount}</td></tr><tr><td style="padding:12px 10px;border:1px solid #e2e8f0;font-size:14px;font-weight:bold;color:#111827">Total pending actions</td><td align="right" style="padding:12px 10px;border:1px solid #e2e8f0;font-size:19px;font-weight:bold;color:#111827">${total}</td></tr></table>${allClear ? '<p style="font-size:14px;line-height:21px;color:#047857;margin:18px 0 0">There are no SMS messages to review and no posted Cash Book transactions missing particulars. Nothing needs your attention today.</p>' : `<div style="padding:14px 0 8px">${smsAction}${particularsAction}</div>${smsCount && cards ? `<p style="font-size:13px;font-weight:bold;color:#334155;margin:12px 0 8px">SMS messages awaiting review</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${cards}</table>` : ""}`}<p style="font-size:11px;color:#94a3b8;text-align:center;margin:20px 0 0">This is your existing daily reminder. No transactions are automatically posted or changed by this email.</p></td></tr></table></td></tr></table></body></html>`;
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const body = await req.json().catch(() => null);
  const token = String(body?.token || "");
  const force = body?.force === true;
  if (!token) return json({ error: "Unauthorized" }, 401);

  const url = Deno.env.get("SUPABASE_URL");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resend = Deno.env.get("RESEND_API_KEY");
  if (!url || !service || !resend) return json({ error: "Required server configuration is missing" }, 500);

  const db = createClient(url, service, { auth: { persistSession: false } });
  const { data: secret, error: secretError } = await db.from("sms_review_reminder_secrets")
    .select("token_sha256").eq("id", true).maybeSingle();
  if (secretError || !secret || await sha(token) !== secret.token_sha256) return json({ error: "Unauthorized" }, 401);

  const { data: settings, error } = await db.from("sms_review_reminder_settings")
    .select("user_id,recipient_email,send_time,timezone,last_sent_on")
    .eq("enabled", true).not("recipient_email", "is", null);
  if (error) return json({ error: error.message }, 500);

  const results = [];
  for (const setting of settings || []) {
    const local = localParts(setting.timezone || "Asia/Kolkata");
    if (!force && (local.time !== String(setting.send_time).slice(0, 5) || setting.last_sent_on === local.date)) continue;

    const [smsResult, particularsResult, pendingResult] = await Promise.all([
      db.from("sms_capture_inbox").select("id", { count: "exact", head: true })
        .eq("user_id", setting.user_id).eq("status", "needs_review"),
      db.from("cash_movements").select("id", { count: "exact", head: true })
        .eq("user_id", setting.user_id).or("particulars.is.null,particulars.eq."),
      db.from("sms_capture_inbox")
        .select("id,parsed_amount,parsed_direction,parsed_date,parsed_description,received_at,internal_reference")
        .eq("user_id", setting.user_id).eq("status", "needs_review")
        .order("received_at", { ascending: true }).limit(10),
    ]);

    const countError = smsResult.error || particularsResult.error || pendingResult.error;
    if (countError) {
      results.push({ user_id: setting.user_id, status: "query_failed", reason: countError.message });
      continue;
    }
    const smsCount = smsResult.count || 0;
    const particularsCount = particularsResult.count || 0;
    const total = smsCount + particularsCount;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resend}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Payables Tracker <onboarding@resend.dev>",
        to: [setting.recipient_email],
        subject: total === 0
          ? "All clear: no Payables Tracker actions pending"
          : `Payables Tracker: ${total} pending action(s) need attention`,
        html: emailHtml(smsCount, particularsCount, pendingResult.data || [], local.date),
      }),
    });
    const mailResult = await response.json().catch(() => ({}));
    if (!response.ok) {
      results.push({ user_id: setting.user_id, status: "email_failed", status_code: response.status, reason: mailResult.message || mailResult.name || "Provider rejected request" });
      continue;
    }

    if (!force) {
      const { error: updateError } = await db.from("sms_review_reminder_settings")
        .update({ last_sent_on: local.date, updated_at: new Date().toISOString() })
        .eq("user_id", setting.user_id);
      results.push({
        user_id: setting.user_id,
        status: updateError ? "sent_but_state_update_failed" : "sent",
        sms_pending: smsCount, particulars_missing: particularsCount, total_pending: total,
        email_id: mailResult.id || null,
      });
    } else {
      results.push({
        user_id: setting.user_id, status: "test_sent",
        sms_pending: smsCount, particulars_missing: particularsCount, total_pending: total,
        email_id: mailResult.id || null,
      });
    }
  }
  return json({ ok: true, processed: results.length, results });
});
