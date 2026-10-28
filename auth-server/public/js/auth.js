const loginForm = document.querySelector("#loginForm");
const mfaSection = document.querySelector("#mfaSection");
const mfaForm = document.querySelector("#mfaForm");
const message = document.querySelector("#message");
const qr = document.querySelector("#qr");
const mfaTitle = document.querySelector("#mfaTitle");
const mfaHelp = document.querySelector("#mfaHelp");
const verifyButton = document.querySelector("#verifyButton");
let mfaMode = "verify";

async function api(url, body) {
  const response = await fetch(url, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  message.textContent = "Checking credentials…";
  const submitButton = loginForm.querySelector("button[type=submit]");
  submitButton.disabled = true;
  try {
    const result = await api("/api/login", {
      email: document.querySelector("#email").value,
      password: document.querySelector("#password").value
    });
    loginForm.hidden = true;
    mfaSection.hidden = false;
    mfaMode = result.next;
    if (mfaMode === "setup") {
      mfaTitle.textContent = "Set up MFA";
      mfaHelp.textContent = "Scan this QR code with Google Authenticator or another TOTP app. Then enter the current six-digit code.";
      const setup = await api("/api/mfa/setup", {});
      qr.src = setup.qr;
      qr.hidden = false;
    } else {
      mfaTitle.textContent = "Verify your identity";
      mfaHelp.textContent = "Enter the current six-digit code from your authenticator app.";
      qr.hidden = true;
    }
    message.textContent = "";
    document.querySelector("#token").focus();
  } catch (error) {
    message.textContent = error.message;
    submitButton.disabled = false;
  }
});

mfaForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  message.textContent = "Verifying code…";
  verifyButton.disabled = true;
  const tokenInput = document.querySelector("#token");
  const endpoint = mfaMode === "setup" ? "/api/mfa/verify-setup" : "/api/mfa/verify";
  try {
    await api(endpoint, { token: tokenInput.value.trim() });
    window.location.assign("/admin");
  } catch (error) {
    message.textContent = error.message;
    tokenInput.value = "";
    tokenInput.focus();
    verifyButton.disabled = false;
  }
});
