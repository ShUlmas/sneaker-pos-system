// src/app/auth.ts
const AUTH_KEY = "demo_auth";

export function isAuthed() {
    return localStorage.getItem(AUTH_KEY) === "1";
}

export function loginDemo(username: string, password: string) {
    const ok = username === "admin" && password === "1234";
    if (ok) localStorage.setItem(AUTH_KEY, "1");
    return ok;
}

export function logoutDemo() {
    localStorage.removeItem(AUTH_KEY);
}
