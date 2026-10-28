import { supabase, isSupabaseConfigured } from "./supabase-client.js";

const loginForm = document.querySelector("#login-form");
const mfaForm = document.querySelector("#mfa-form");
const mfaPanel = document.querySelector("#mfa-panel");
const statusBox = document.querySelector("#status");
const qrImage = document.querySelector("#mfa-qr");
const secretHelp = document.querySelector("#mfa-secret-help");
const secretText = document.querySelector("#mfa-secret");
const mfaTitle = document.querySelector("#mfa-title");
const mfaHelp = document.querySelector("#mfa-help");
const codeInput = document.querySelector("#mfa-code");
let currentFactorId = null;
let mode = "verify"; // "enroll" or "verify"
let busy = false;

function showStatus(message, isError = false) {
  statusBox.textContent = message;
  statusBox.classList.toggle("text-danger", isError);
  statusBox.classList.toggle("text-success", !isError && Boolean(message));
}
function setBusy(value) {
  busy = value;
  loginForm.querySelector("button[type=submit]").disabled = value;
  mfaForm.querySelector("button[type=submit]").disabled = value;
}
function openCodePanel(nextMode, factorId, qrCode = "", secret = "") {
  mode = nextMode;
  currentFactorId = factorId;
  loginForm.hidden = true;
  mfaPanel.hidden = false;
  qrImage.hidden = !qrCode;
  secretHelp.hidden = !secret;
  if (qrCode) qrImage.src = qrCode;
  if (secret) secretText.textContent = secret;
  if (nextMode === "enroll") {
    mfaTitle.textContent = "Set up Google Authenticator";
    mfaHelp.textContent = "Scan this QR code with Google Authenticator, then enter the six-digit code it generates to finish enrollment.";
  } else {
    mfaTitle.textContent = "Verify your identity";
    mfaHelp.textContent = "Enter the current six-digit code from your authenticator app.";
  }
  codeInput.focus();
}

async function enrollMfa() {
  // Remove a previous incomplete factor so a fresh enrollment QR can be shown.
  const { data: listed, error: listError } = await supabase.auth.mfa.listFactors();
  if (listError) throw listError;
  const unverified = (listed.totp || []).filter(f => f.status !== "verified");
  for (const factor of unverified) {
    const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
    if (error) throw error;
  }
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "Portfolio Admin"
  });
  if (error) throw error;
  openCodePanel("enroll", data.id, data.totp.qr_code, data.totp.secret);
}

async function routeAfterPasswordSignIn() {
  const { data: aal, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aalError) throw aalError;
  if (aal.currentLevel === "aal2") {
    window.location.replace("admin.html");
    return;
  }
  const { data: listed, error: listError } = await supabase.auth.mfa.listFactors();
  if (listError) throw listError;
  const verified = (listed.totp || []).find(f => f.status === "verified");
  if (verified) {
    openCodePanel("verify", verified.id);
  } else {
    await enrollMfa();
  }
}

loginForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (busy) return;
  if (!isSupabaseConfigured) {
    showStatus("Setup needed: add your Supabase publishable key in assets/js/supabase-client.js.", true);
    return;
  }
  setBusy(true);
  showStatus("Checking admin credentials…");
  try {
    const email = document.querySelector("#email").value.trim();
    const password = document.querySelector("#password").value;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    await routeAfterPasswordSignIn();
  } catch (error) {
    showStatus(error.message || "Sign in failed.", true);
  } finally {
    setBusy(false);
  }
});

mfaForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (busy) return;
  const code = codeInput.value.trim();
  if (!/^\d{6}$/.test(code) || !currentFactorId) {
    showStatus("Enter the six-digit code from your authenticator app.", true);
    return;
  }
  setBusy(true);
  showStatus("Verifying authenticator code…");
  try {
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: currentFactorId });
    if (challengeError) throw challengeError;
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: currentFactorId,
      challengeId: challenge.id,
      code
    });
    if (verifyError) throw verifyError;
    const { data: aal, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalError) throw aalError;
    if (aal.currentLevel !== "aal2") throw new Error("MFA was not verified at the required level. Please try again.");
    showStatus("Verified. Opening your admin dashboard…");
    window.location.replace("admin.html");
  } catch (error) {
    showStatus(error.message || "MFA verification failed.", true);
    codeInput.value = "";
    codeInput.focus();
  } finally {
    setBusy(false);
  }
});

async function restoreSession() {
  if (!isSupabaseConfigured) return;
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return;
  try {
    const { data: aal, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error) throw error;
    if (aal.currentLevel === "aal2") {
      window.location.replace("admin.html");
      return;
    }
    const { data: listed, error: listError } = await supabase.auth.mfa.listFactors();
    if (listError) throw listError;
    const verified = (listed.totp || []).find(f => f.status === "verified");
    if (verified) openCodePanel("verify", verified.id);
  } catch (error) {
    showStatus(error.message || "Could not restore sign-in session.", true);
  }
}
restoreSession();
