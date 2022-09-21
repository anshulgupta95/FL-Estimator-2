const express = require('express');
const router = express.Router();
const app = express();
var XMLHttpRequest = require('xhr2');
const { DOMParser } = require('xmldom');
const got = require('got');
const cheerio = require('cheerio');
const port = 3000;
let sitemapFile = 'sitemap.xml';
const { create } = require('xmlbuilder2');
// const fs = require('fs');
const moment = require('moment');
var logger = require('./utils/logger');
const urlExists = require('url-exists');
var striptags = require('striptags');

app.use(express.json());
app.use(function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});
app.use('/', router);

router.get('/test', (req, res) => {
  logger.info('Server Sent A Hello World!');
  res.send('Hello from test!');
});

router.post('/carryover', async (req, res) => {
  logger.info('Line 31 | Start CarryOver!');
  getContent(req, res);
});

async function getContent(req, res) {
  var allPagesHTML = [];
  const pages = req.body.pages;
  logger.info('Line 38 | Pages:' + pages);
  try {
    await Promise.all(
      pages.map(async (page) => {
        //console.log('page', page);
        const response = await got(page.url, { retry: { limit: 3, methods: ['GET', 'POST'], timeout: 0 } });
        logger.info('Line 43 | response:' + response);
        console.log('response:');
        const html = response.body;
        const $ = cheerio.load(html);
        logger.info('html:' + $);
        // Settings data
        var pageContent =
          page.settings.contentId !== '' && page.settings.contentId !== undefined
            ? $(page.settings.contentId.toString()).html()
            : '';
        if (pageContent !== null && pageContent !== undefined) {
          pageContent = striptags(pageContent, [
            'h1',
            'h2',
            'h3',
            'h4',
            'h5',
            'p',
            'ul',
            'li',
            'a',
            '<strong>',
            '<span>',
          ]);
          //          console.log('cleanedPageContent: ', pageContent);

          // const stringifiedJson = JSON.stringify(pageContent).replace(/https?:\/\/[^\/]+/g, '');
          // // console.log('stringifiedJson: ', stringifiedJson);

          // pageContent = JSON.parse(stringifiedJson);
          // console.log('pageContent: ', pageContent);
        }

        var pageTitle =
          page.settings.titleId !== '' && page.settings.titleId !== undefined
            ? $(page.settings.titleId.toString()).html()
            : '';
        // var pageUrlTitle = (page.settings.urlTitleId !== '') ? $(page.settings.urlTitleId.toString()).html() : '';
        var pageDate =
          page.settings.dateId !== '' && page.settings.dateId !== undefined
            ? $(page.settings.dateId.toString()).html()
            : '';
        console.log('pageDate:', pageDate);

        // let isValid = false;

        if (pageDate !== '' && pageDate !== undefined) {
          // valid = moment(pageDate, 'MMMM DD, YYYY').isValid();
          // console.log('valid: ', valid);
          if (moment(pageDate, 'DD-MM-YYYY').isValid()) {
            let date = moment(pageDate.toString(), 'DD-MM-YYYY');
            pageDate = date.format('YYYY-MM-DD HH:mm:ss');
          } else if (moment(pageDate, 'DD/MM/YYYY').isValid()) {
            let date = moment(pageDate.toString(), 'DD/MM/YYYY');
            pageDate = date.format('YYYY-MM-DD HH:mm:ss');
          } else if (moment(pageDate, 'YYYY-MM-DD').isValid()) {
            let date = moment(pageDate.toString(), 'YYYY-MM-DD');
            pageDate = date.format('YYYY-MM-DD HH:mm:ss');
          } else if (moment(pageDate, 'MMMM DD, YYYY').isValid()) {
            let date = moment(pageDate.toString(), 'MMMM DD, YYYY');
            pageDate = date.format('YYYY-MM-DD HH:mm:ss');
          } else if (moment(pageDate, 'MMMM YYYY').isValid()) {
            let date = moment(pageDate.toString(), 'MMMM YYYY');
            pageDate = date.format('YYYY-MM-DD HH:mm:ss');
          } else if (moment(pageDate, 'DD MMM YYYY').isValid()) {
            let date = moment(pageDate.toString(), 'DD MMM YYYY');
            pageDate = date.format('YYYY-MM-DD HH:mm:ss');
          }
          console.log('pageDate:', pageDate);
        }
        var pageAuthor =
          page.settings.authorId !== '' && page.settings.authorId !== undefined
            ? $(page.settings.authorId.toString()).html()
            : '';

        var pageCategories =
          page.settings.categoriesId !== '' && page.settings.categoriesId !== undefined
            ? $(page.settings.categoriesId.toString()).html()
            : '';
        var pageTags =
          page.settings.tagsId !== '' && page.settings.tagsId !== undefined
            ? $(page.settings.tagsId.toString()).html()
            : '';
        isPage = page.settings.isPage;
        logger.info('settings');

        // Meta data
        var metaTitle = '';
        var metaContent = '';
        if (page.metaData.title === true) {
          metaTitle = $('meta[property="og:title"]').attr('content');
          if (metaTitle === undefined) metaTitle = $('title').html();
        } else metaTitle = 'None';
        if (page.metaData.content === true) {
          metaContent = $('meta[property="og:description"]').attr('content');
          if (metaContent === undefined) metaContent = $('meta[name="description"]').attr('content');
        } else metaTitle = 'None';
        logger.info('meta');

        var pageData = {};
        if (isPage !== '') {
          if (isPage) {
            logger.info('isPage');
            pageData = {
              pageTitle: pageTitle,
              pageContent: pageContent,
              // pageUrlTitle: pageUrlTitle,
              metaTitle: metaTitle,
              metaContent: metaContent,
            };
          } else {
            logger.info('isBlog');
            pageData = {
              pageTitle: pageTitle,
              pageContent: pageContent,
              // pageUrlTitle: pageUrlTitle,
              pageDate: pageDate,
              pageAuthor: pageAuthor,
              pageCategories: pageCategories,
              pageTags: pageTags,
              metaTitle: metaTitle,
              metaContent: metaContent,
            };
            if (pageData.pageAuthor === '') pageData.pageAuthor = 'test-author';
          }
          logger.info('Push pageData:');
          allPagesHTML.push(pageData);
        }
      }),
    );
    if (allPagesHTML.length > 0 && isPage !== '') {
      logger.info('isPage:' + isPage);
      if (isPage) createPageXML(allPagesHTML, res);
      else createBlogXML(allPagesHTML, res);
    } else {
      res.send('Please select if the url is a page/blog');
      logger.error(`${500} - ${'Please select if the url is a page/blog'}`);
    }
  } catch (err) {
    logger.error(`${'Error:'} - ${err.status} - ${err.message}`);
  }
}

function createPageXML(allPagesHTML, res) {
  let root = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('rss', {
      'version': '2.0',
      'xmlns:excerpt': 'http://wordpress.org/export/1.2/excerpt/',
      'xmlns:content': 'http://purl.org/rss/1.0/modules/content/',
      'xmlns:wfw': 'http://wellformedweb.org/CommentAPI/',
      'xmlns:dc': 'http://purl.org/dc/elements/1.1/',
      'xmlns:wp': 'http://wordpress.org/export/1.2/',
    })
    .ele('channel')
    .ele('language')
    .txt('en-US')
    .up()
    .ele('wp:wxr_version')
    .txt('1.2')
    .up()
    .ele('generator')
    .txt('https://wordpress.org/?v=5.0.2')
    .up();

  for (i = 0; i < allPagesHTML.length; i++) {
    const itemData = root
      .ele('item')
      .ele('title')
      .txt(allPagesHTML[i].pageTitle)
      .up()
      .ele('dc:creator')
      .dat('admin')
      .up()
      .ele('description')
      .up()
      .ele('content:encoded')
      .dat(allPagesHTML[i].pageContent)
      .up()
      .ele('excerpt:encoded')
      .dat(' ')
      .up()
      .ele('wp:comment_status')
      .dat('closed')
      .up()
      .ele('wp:ping_status')
      .dat('closed')
      .up()
      .ele('wp:status')
      .dat('publish')
      .up()
      .ele('wp:post_type')
      .dat('page')
      .up()
      .ele('wp:post_password')
      .dat('')
      .up()
      .ele('wp:postmeta')
      .ele('wp:meta_key')
      .dat('_aioseop_description')
      .up()
      .ele('wp:meta_value')
      .dat(allPagesHTML[i].metaContent)
      .up()
      .up()
      .ele('wp:postmeta')
      .ele('wp:meta_key')
      .dat('_aioseop_title')
      .up()
      .ele('wp:meta_value')
      .dat(allPagesHTML[i].metaTitle)
      .up()
      .up();
  }

  const xml = root.end({ prettyPrint: true });
  logger.info('Set Page XML');

  // Write to file
  // const parsedXml = parseString(xml);
  // let full_file_name = "./" + req_name;
  // fs.writeFileSync(full_file_name, xml, function(err) {
  //     if (err) throw err;
  // });
  // res.header('Content-Type', 'text/xml').status(200).send(xml);
  res.status(200).send({ xml: xml });
}

function createBlogXML(allPagesHTML, res) {
  let root = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('rss', {
      'version': '2.0',
      'xmlns:excerpt': 'http://wordpress.org/export/1.2/excerpt/',
      'xmlns:content': 'http://purl.org/rss/1.0/modules/content/',
      'xmlns:wfw': 'http://wellformedweb.org/CommentAPI/',
      'xmlns:dc': 'http://purl.org/dc/elements/1.1/',
      'xmlns:wp': 'http://wordpress.org/export/1.2/',
    })
    .ele('channel')
    .ele('language')
    .txt('en-US')
    .up()
    .ele('wp:wxr_version')
    .txt('1.2')
    .up()
    .ele('generator')
    .txt('https://wordpress.org/?v=5.0.2')
    .up();

  for (i = 0; i < allPagesHTML.length; i++) {
    const itemData = root
      .ele('item')
      .ele('title')
      .txt(allPagesHTML[i].pageTitle)
      .up()
      .ele('dc:creator')
      .dat(allPagesHTML[i].pageAuthor)
      .up()
      .ele('description')
      .up()
      .ele('content:encoded')
      .dat(allPagesHTML[i].pageContent)
      .up()
      .ele('excerpt:encoded')
      .dat(' ')
      .up()
      .ele('wp:post_date')
      .dat(allPagesHTML[i].pageDate)
      .up()
      .ele('wp:comment_status')
      .dat('closed')
      .up()
      .ele('wp:ping_status')
      .dat('closed')
      .up()
      .ele('wp:status')
      .dat('publish')
      .up()
      .ele('wp:post_type')
      .dat('post')
      .up()
      .ele('wp:post_password')
      .dat('')
      .up()
      .ele('category')
      .att('domain', 'category')
      .att('nicename', allPagesHTML[i].pageCategories)
      .dat(allPagesHTML[i].pageCategories)
      .up()
      .ele('posttag')
      .att('domain', 'posttag')
      .att('nicename', allPagesHTML[i].pageTags)
      .dat(allPagesHTML[i].pageTags)
      .up();
  }

  const xml = root.end({ prettyPrint: true });
  logger.info('Set Page XML');
  // console.log('XML:', xml);

  // const parsedXml = parseString(xml);
  // let full_file_name = "./" + req_name;
  // fs.writeFileSync(full_file_name, xml, function(err) {
  //     if (err) throw err;
  // });

  // res.header('Content-Type', 'text/xml').send(parsedXml);
  res.status(200).send({ xml: xml });
}

app.post('/estimator', (req, res) => {
  const url = req.body.url;
  console.log('url', url);
  var length = 0;
  var sitemaps = 0;
  var loopSitemaps = 0;
  var count = 0;
  let allURLs = [];
  let blogs = [];
  let pages = [];
  let pageData = {};
  let allImages = [];
  let allPageLinks = [];
  let countPages = 0;
  let pdfPages = [];

  // Get Sitemap content and parse it to DOM
  async function getSitemapURLs(sitemapFile, callback) {
    setTimeout(() => {
      const sitemapURL = url + sitemapFile;
      console.log('sitemapURL:', sitemapURL);
      urlExists(sitemapURL, function (err, exists) {
        console.log(exists); // true
        if (exists) {
          var xhttp = new XMLHttpRequest();
          xhttp.onreadystatechange = function () {
            if (this.readyState == 4 && this.status == 200) {
              var sitemapContent = xhttp.responseText;
              console.log('siteContent: ');
              var XMLSitemap = parseXMLSitemap(sitemapContent);
              console.log('xml: ');
              sitemaps = XMLSitemap.getElementsByTagName('sitemap');
              // var subSitemapContent = undefined;
              console.log('sitemaps.length:', sitemaps.length);
              if (sitemaps !== undefined && sitemaps.length > 0) {
                for (var i = 0; i < sitemaps.length; i++) {
                  var x = new XMLHttpRequest();
                  x.onreadystatechange = function () {
                    if (this.readyState == 4 && this.status == 200) {
                      loopSitemaps = loopSitemaps + 1;
                      var subSitemapContent = this.responseText;
                      var subXMLSitemap = parseXMLSitemap(subSitemapContent);
                      console.log('sub: ');
                      callback(subXMLSitemap);
                    }
                  };
                  console.log('subFileName: ', sitemaps[i].getElementsByTagName('loc')[0].textContent);
                  x.open('GET', sitemaps[i].getElementsByTagName('loc')[0].textContent, true);
                  x.send();
                }
              } // else {
              //   console.log('nonsitemaps');
              //   getNonSitemapURLS(url);
              // }
              callback(XMLSitemap);
            }
          };
          xhttp.open('GET', url + sitemapFile, true);
          xhttp.send();
        } else {
          console.log('nonsitemaps');
          getNonSitemapURLS(url);
        }
      });
    }, 5000);
  }

  // retrieving info from sitemap
  getSitemapURLs(sitemapFile, function (XMLSitemap) {
    try {
      var urls = XMLSitemap.getElementsByTagName('url');
      console.log('urls:');
      count++;

      for (var i = 0; i < urls.length; i++) {
        var urlElement = urls[i];
        var loc = urlElement.getElementsByTagName('loc')[0].textContent;
        allURLs.push(loc);

        if (loc.includes('/tag/') || loc.includes('/categories/') || loc.includes('/post/') || loc.includes('/blog/')) {
          blogs.push(loc);
        } else {
          pages.push(loc);
        }
      }
      console.log('pages: ', pages);
      length = length + urls.length;

      if (loopSitemaps === sitemaps.length || loopSitemaps === undefined) {
        allURLs.forEach((pageUrl) => {
          console.log('pageUrl: ', pageUrl);
          getImages(pageUrl);
        });
      }
    } catch (err) {
      console.log('err:', err);
    }
  });

  async function getNonSitemapURLS(url) {
    console.log('url', url);
    try {
      //console.log('url', url);
      const response = await got.post(url, { retry: { limit: 3, methods: ['GET', 'POST'], timeout: 0 } });
      console.log('response', response);
      const html = response.body;
      console.log('html', html);
      const $ = cheerio.load(html);
      console.log('link count:', $('a').length);

      $('a').each(function () {
        var link = $(this);
        var linkUrl = link.attr('href');
        // console.log('linkUrl: ', linkUrl);
        if (linkUrl !== '' && linkUrl != null && linkUrl !== undefined) {
          var newURL = '';
          if (linkUrl.charAt(0) === '/' || !linkUrl.startsWith('http')) {
            if (linkUrl.charAt(0) === '/') {
              linkUrl = linkUrl.substring(1);
            }
            newURL = url + linkUrl;

            // console.log('newURL:', newURL);

            if (!allPageLinks.includes(newURL) && !newURL.includes('site-map') && newURL.startsWith(url)) {
              allPageLinks.push(newURL);
              if (
                newURL.includes('/tag/') ||
                newURL.includes('/categories/') ||
                newURL.includes('/post/') ||
                newURL.includes('/blog/')
              ) {
                blogs.push(newURL);
              } else {
                pages.push(newURL);
              }
            }
          } else if (!allPageLinks.includes(linkUrl) && linkUrl.startsWith(url)) {
            allPageLinks.push(linkUrl);
            if (
              newURL.includes('/tag/') ||
              newURL.includes('/categories/') ||
              newURL.includes('/post/') ||
              newURL.includes('/blog/')
            ) {
              blogs.push(newURL);
            } else {
              pages.push(newURL);
            }
          }
        }
      });
      allURLs = [];
      countPages = 0;
      allURLs = allPageLinks;
      console.log('allUrls length:', allURLs.length);
      console.log('allURLs:', allURLs);
      allURLs.forEach((pageUrl) => {
        // console.log('pageUrl: ', pageUrl);
        getImages(pageUrl);
      });
    } catch (err) {
      // console.log('err:', err);
    }
  }

  async function getImages(pageUrl) {
    try {
      const response = await got.post(pageUrl, { retry: { limit: 3, methods: ['GET', 'POST'], timeout: 0 } });
      if (response.statusCode === 200) {
        if (pageUrl.includes('.pdf')) {
          pdfPages.push(pageUrl);
        }

        const html = response.body;
        const $ = cheerio.load(html);
        console.log('image count:', $('img').length);

        $('img').each(function () {
          var image = $(this);
          var src = image.attr('src');
          if (src !== '' && src != null && src !== undefined) {
            if (src.charAt(0) === '/') {
              src = src.substring(1);
            }
            var imageUrl = url + src;
            console.log('imageUrl', imageUrl);
            if (!allImages.includes(imageUrl)) {
              console.log('true');
              allImages.push(imageUrl);
            } else {
              console.log('false');
              console.log(imageUrl);
            }
            console.log('allImages Length:', allImages.length);
          }
        });
        countPages = countPages + 1;
        console.log('count: ', +' ' + countPages + ' ' + allURLs.length + ' ' + pageUrl);

        if (countPages === allURLs.length) {
          console.log('Images:', allImages.length);
          var pageEffortData = effortcalculation(pages.length);
          var blogEffortData = effortcalculation(blogs.length);
          //debugger;
          pageData = {
            allURLs: JSON.stringify(allURLs),
            blogs: blogs.length,
            pages: pages.length,
            images: allImages.length,
            pdfCount: pdfPages.length,
            pagesTotalEffortHrs: pageEffortData.totalEffortHrs,
            pagesTotalDays: pageEffortData.totalDays,
            blogsTotalEffortHrs: blogEffortData.totalEffortHrs,
            blogsTotalDays: blogEffortData.totalDays,
          };
          console.log('All Images:', allImages);
          res.send(pageData);
        }
      }
    } catch (err) {
      console.log('err:', err.response.url);
      console.log('err:', err.response.statusCode);
      console.log('Images:', allImages.length);
      var pageEffortData = effortcalculation(pages.length);
      var blogEffortData = effortcalculation(blogs.length);
      //debugger;
      pageData = {
        allURLs: JSON.stringify(allURLs),
        blogs: blogs.length,
        pages: pages.length,
        images: allImages.length,
        pdfCount: pdfPages.length,
        pagesTotalEffortHrs: pageEffortData.totalEffortHrs,
        pagesTotalDays: pageEffortData.totalDays,
        blogsTotalEffortHrs: blogEffortData.totalEffortHrs,
        blogsTotalDays: blogEffortData.totalDays,
      };
      console.log('All Images:', allImages);
      res.send(pageData);
    }
  }

  function effortcalculation(numberOfItems) {
    var totaleffortpages = Math.ceil((0.2 * numberOfItems) / 60);
    var effortData = {
      totalEffortHrs: totaleffortpages,
      totalDays: Math.ceil(totaleffortpages / 8.0),
    };
    return effortData;
  }

  // parse a text string into an XML DOM object
  function parseXMLSitemap(sitemapContent) {
    var parser = new DOMParser();
    var xmlDoc = parser.parseFromString(sitemapContent, 'text/xml');
    return xmlDoc;
  }
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}!`);
});
