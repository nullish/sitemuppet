/**
 * @name Sitemuppet,
 *
 * @desc parallel scraping array of sitemap of pages to find user specified element attribute values
 */

 const puppeteer = require('puppeteer')
 fs = require('fs');
 const yargs = require('yargs')
 var parser = require('xml2json');

// Command line arguments from yargs
const argv = yargs
.option('parallel', {
  alias: 'p',
  default: 8,
  describe: 'Number of parallel instances',
  type: 'number'
})
.option('sitemap', {
  alias: 'x',
  default: './sitemaps/sitemap.xml',
  describe: 'File path to XML sitemap',
  type: 'string'
})
.option('timeout', {
  alias: 't',
  default: 30000,
  describe: 'Default timeout in milliseconds',
  type: 'number'
})
.option('waitfor', {
  alias: 'w',
  default: '//title',
  describe: 'XML selector for element to wait for',
  type: 'string'
})
.option('querys', {
  alias: 'q',
  default: "(//div[@class='flex-video']/iframe)[1]",
  describe: 'XML selector for element to capture',
  type: 'string'
}) 
.option('attrb', {
  alias: 'a',
  default: 'src',
  describe: 'HTML attribute value to report',
  type: 'string'
})
.argv;

const parallel = argv.parallel;
const sitemap = argv.sitemap;
const timeout = argv.timeout;
const waitfor = argv.waitfor;
const querys = argv.querys;
const attrb = argv.attrb;

const sitemuppet = async (parallel, sitemap, timeout, waitfor, querys, attrb) => {

// read sitemap xml file
const xmlSiteMap = fs.readFileSync(sitemap)
  // convert sitemap to json for easier javascript parsing
  const jsonSiteMap = parser.toJson(xmlSiteMap)
  const json = JSON.parse(jsonSiteMap)
  const urls = json.urlset.url
  let arrPages = []

  // Build array of URLs for scrape function.
  for (e of urls) {
    arrPages.push(e.loc)
  }

  const parallelBatches = Math.ceil(arrPages.length / parallel)

  console.log(`Scraping ${arrPages.length} pages for '${querys}' elements, in batches of ${parallel}`)

  console.log(`This will result in ${parallelBatches} batches.`)
  console.log('"timestamp","batch","index","URL","attribute","Error"')

  // Split up the Array of arrPages
  let k = 0
  for (let i = 0; i < arrPages.length; i += parallel) {
    k++
    // Launch and Setup Chromium
    const browser = await puppeteer.launch();
    const context = await browser.createIncognitoBrowserContext();
    const page = await context.newPage();
    page.setJavaScriptEnabled(true)

    const promises = []
    for (let j = 0; j < parallel; j++) {
      let elem = i + j
      // only proceed if there is an element 
      if (arrPages[elem] != undefined) {
        // Promise to scrape pages
        // promises push
        promises.push(browser.newPage().then(async page => {          
          try {
            // Set default navigation timeout.
            await page.setDefaultNavigationTimeout(timeout); 
            // Goto page, wait for timeout as specified in JSON input
            await page.goto(arrPages[elem])
            // Element to wait for to confirm page load
            await page.waitForXPath(waitfor);
            // Get element to search for and report about
            let elHandle = await page.$x(querys);
            let timeStamp = new Date(Date.now()).toUTCString();
            // Get attribute value to report
            if (elHandle.length > 0) {
              let txtOut
              // Get HTML or text value of element if specified. Otherwise get value specified by attribute.
              switch (attrb) {
                case "innerText":
                txtOut = await page.evaluate((el) => el.innerText, elHandle[0]);
                console.log(`"${timeStamp}","${k}","${j}","${arrPages[elem]}","${txtOut}",""`);
                break;
                case "innerHTML":
                txtOut = await page.evaluate((el) => el.innerHTML, elHandle[0]);
                console.log(`"${timeStamp}","${k}","${j}","${arrPages[elem]}","${txtOut}",""`);
                break;
                default:
                txtOut = await page.evaluate((el,a) => el.getAttribute(a), elHandle[0], attrb);
                console.log(`"${timeStamp}","${k}","${j}","${arrPages[elem]}","${txtOut}",""`)
              }
            } else {
              // response if element not fiund on page
              console.log(`"${timeStamp}","${k}","${j}","${arrPages[elem]}","","ELEMENT NOT FOUND"`)
            }
          } catch (err) {
            // Report failing element and standard error response
            let timeStamp = new Date(Date.now()).toUTCString();
            console.log(`"${timeStamp}","${k}","${j}","${arrPages[elem]}","","${err}"`)
          }
        }))
      }
    }

    // await promise all and close browser
    await Promise.all(promises)
    await browser.close()
  }
}

sitemuppet(parallel, sitemap, timeout, waitfor, querys, attrb)

