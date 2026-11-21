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

test.beforeAll(()=>{
  if(!email||!password) throw new Error("TEST_USER_EMAIL and TEST_USER_PASSWORD are required.");
});

test("users can add expense categories and cash expenses post to Physical Cash",async({page},testInfo)=>{
  const dialogs:string[]=[];
  page.on("dialog",async dialog=>{
    dialogs.push(dialog.message());
    await dialog.accept();
  });

  await establishAuthenticatedSession(page);
  const marker="E2E-CAT-"+Date.now();
  const categoryName=marker+" Travel";
  const description=marker+" Cash Expense";
  const today=new Date().toISOString().slice(0,10);

  await expect(page.locator("#cat option").filter({hasText:"Other"})).toHaveCount(1);
  await page.locator("#manageCategories").click();
  await expect(page.locator("#categoriesDlg")).toBeVisible();
  const categoryInsert=page.waitForResponse(response=>
    response.url().includes("/rest/v1/expense_categories") &&
    response.request().method()==="POST",
    {timeout:20000}
  );
  await page.locator("#newCategoryName").fill(categoryName);
  await page.locator("#categoryForm button[type=submit]").click();
  const categoryResponse=await categoryInsert;
  const categoryBody=await categoryResponse.text();
  expect(categoryResponse.ok(),"Category insert failed: "+categoryResponse.status()+" "+categoryBody).toBeTruthy();
  await expect(page.locator("#categoriesDlg")).not.toBeVisible();
  await expect(page.locator("#cat")).toHaveValue(categoryName);

  // The category must still be available after a fresh application load.
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-dashboard-ready","true",{timeout:30000});
  await expect(page.locator("#cat option").filter({hasText:categoryName})).toHaveCount(1);

  // A Cash payment automatically uses the system-managed Physical Cash account.
  await page.locator("#add").click();
  await page.locator("#desc").fill(description);
  await page.locator("#amt").fill("125");
  await page.locator("#transactionDate").fill(today);
  await page.locator("#cat").selectOption({label:categoryName});
  await page.locator("#paymentMethod").selectOption("cash");
  await expect(page.locator("#paymentAccountField")).toBeHidden();

  const expenseResponsePromise=page.waitForResponse(response=>
    response.url().includes("/rest/v1/rpc/create_expense_v1") &&
    response.request().method()==="POST",
    {timeout:20000}
  );
  await page.locator("#form").getByRole("button",{name:"Save",exact:true}).click();
  const expenseResponse=await expenseResponsePromise;
  const expenseBody=await expenseResponse.text();
  expect(expenseResponse.ok(),"Cash expense save failed: "+expenseResponse.status()+" "+expenseBody).toBeTruthy();
  await expect(page.locator("#dlg")).not.toBeVisible();
  await page.locator("#statusF").selectOption("all");
  await expect(page.locator("#list")).toContainText(description);

  // Verify the transaction created a debit against the dedicated Cash Book account.
  await page.goto("/cashbook.html");
  await expect(page.locator("#signedInEmail")).toContainText(new RegExp(email,"i"));
  await expect(page.locator("#accountSelect option").filter({hasText:"Physical Cash"})).toHaveCount(1);
  await page.locator("#accountSelect").selectOption({label:"Physical Cash"});
  const cashRow=page.locator("#transactions .ledger-table tbody tr").filter({hasText:description});
  await expect(cashRow).toHaveCount(1);
  await expect(cashRow.locator(".debit")).toContainText("125.00");

  expect(dialogs,"The category and cash-payment workflow should not raise application alerts").toEqual([]);
  await page.screenshot({path:testInfo.outputPath("physical-cash-custom-category.png"),fullPage:true,animations:"disabled"});
});
