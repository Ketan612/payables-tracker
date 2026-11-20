import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
 testDir:"./tests/e2e",fullyParallel:false,workers:1,forbidOnly:!!process.env.CI,retries:0,
 reporter:process.env.CI?[["list"],["html",{outputFolder:"playwright-report",open:"never"}]]:"list",
 timeout:180000,expect:{timeout:15000},
 use:{baseURL:process.env.BASE_URL||"https://payables-tracker-ten.vercel.app",trace:"retain-on-failure",screenshot:"on",video:"on"},
 projects:[{name:"chromium",use:{...devices["Desktop Chrome"]}}]
});