/**
 * @name Sitemuppet
 *
 * @desc parallel scraping array of sitemap of pages to find user specified element attribute values
 */

 const puppeteer = require('puppeteer')
 fs = require('fs');
 const argv = yargs
 var parser = require('xml2json');

 const sitemuppet = async (args...) => {
  /* args
  parallel
  sitemap xml filepath
  default timeout
  element to wait for 
  xpath query selector
  html attribute
  */
// read sitemap xml file
const xmlSiteMap = fs.readFileSync("./sitemap.xml")
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

  console.log('Scraping ' + arrPages.length + ' pages for video carousel components, in batches of ' + parallel)

  console.log(' This will result in ' + parallelBatches + ' batches.')
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
            await page.setDefaultNavigationTimeout(60000); 
            // Goto page, wait for timeout as specified in JSON input
            await page.goto(arrPages[elem])
            // Element to wait for to confirm page load
            await page.waitForXPath("//title");
            // Get element to search for and report about
            let elHandle = await page.$x("(//div[@class='flex-video']/iframe)[1]");
            let timeStamp = new Date(Date.now()).toUTCString();
            // Get attribute value to report
            if (elHandle.length > 0) {
              let txtOut = await page.evaluate(el => el.getAttribute('src'), elHandle[0]);
              console.log(`"${timeStamp}","${k}","${j}","${arrPages[elem]}","${txtOut}",""`)
            } else {
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

module.exports = sitemuppet;
