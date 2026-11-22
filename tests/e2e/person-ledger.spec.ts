import {test,expect,Page} from "@playwright/test";

const email=process.env.TEST_USER_EMAIL!;
const password=process.env.TEST_USER_PASSWORD!;

async function establishAuthenticatedSession(page:Page){
  await page.goto("/");
  await expect(page.locator("#loginForm")).toBeVisible();
  await page.locator("#loginEmail").fill(email);
  await page.locator("#loginPassword").fill(password);
  await page.locator("#loginForm button[type=submit]").click();
  await expect(page.locator("#welcomeMessage")).toContainText(/.+/,{timeout:20000});
  await expect(page.locator("html")).toHaveAttribute("data-dashboard-ready","true",{timeout:30000});
}

test("Person Ledger opens, shows aligned totals, scrolls independently and resets shared dialog mode",async({page})=>{
  test.skip(!email||!password,"A dedicated isolated-backend test user is required.");
  await establishAuthenticatedSession(page);

  const personButtons=page.locator("#peopleList [data-person-open]");
  await expect(personButtons.first()).toBeVisible({timeout:15000});
  await personButtons.first().click();

  const dialog=page.locator("#balanceDetailDlg");
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveClass(/person-ledger-open/);
  await expect(page.locator("#balanceDetailTitle")).toContainText(/.+/);

  const ledger=page.locator("#balanceDetailTransactions .person-ledger-table-wrap");
  await expect(ledger).toBeVisible();
  const rows=page.locator("#balanceDetailTransactions .person-ledger-table-row");
  const empty=page.locator("#balanceDetailTransactions .person-ledger-empty");
  const rowCount=await rows.count();

  if(rowCount>0){
    const total=page.locator("#balanceDetailTransactions .person-ledger-total");
    await expect(total).toBeVisible();
    await expect(total.locator(".person-ledger-total-cell")).toHaveCount(3);
    await expect(total).toContainText("Amount");
    await expect(total).toContainText("Settled");
    await expect(total).toContainText("Outstanding");
  }else{
    await expect(empty).toBeVisible();
  }

  // On narrow screens, the dialog remains within the viewport and its ledger
  // is the independently scrollable region (no page-level horizontal overflow).
  await page.setViewportSize({width:390,height:844});
  const dimensions=await dialog.evaluate(el=>{
    const rect=el.getBoundingClientRect();
    const wrap=el.querySelector(".person-ledger-table-wrap") as HTMLElement|null;
    return {
      dialogRight:rect.right,
      viewportWidth:window.innerWidth,
      wrapClient:wrap?.clientHeight??0,
      wrapScroll:wrap?.scrollHeight??0,
      wrapOverflowY:wrap?getComputedStyle(wrap).overflowY:""
    };
  });
  expect(dimensions.dialogRight).toBeLessThanOrEqual(dimensions.viewportWidth+1);
  expect(["auto","scroll"]).toContain(dimensions.wrapOverflowY);

  await page.locator("#closeBalanceDetail").click();
  await expect(dialog).not.toBeVisible();
  await expect(dialog).not.toHaveClass(/person-ledger-open/);
});
