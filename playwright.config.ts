import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
 testDir:"./tests/e2e",fullyParallel:false,workers:1,forbidOnly:!!process.env.CI,retries:process.env.CI?1:0,
 reporter:process.env.CI?[["list"],["html",{outputFolder:"playwright-report",open:"never"}]]:"list",
 timeout:45000,expect:{timeout:10000},
 use:{baseURL:process.env.BASE_URL||"https://payables-tracker-ten.vercel.app",trace:"retain-on-failure",screenshot:"only-on-failure",video:"retain-on-failure"},
 projects:[{name:"chromium",use:{...devices["Desktop Chrome"]}},{name:"mobile-chromium",use:{...devices["iPhone 13"],defaultBrowserType:"chromium"}}]
});