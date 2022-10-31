const express = require('express');
const router = express.Router();
const app = express();
const { DOMParser } = require('xmldom');
const cheerio = require('cheerio');
var logger = require('./utils/logger');
// const port = process.env.NODE_ENV === 'production' ? (process.env.PORT || 80) : 3000;
const port = 8001;
// const port = process.env.NODE_PORT || 3000;
let sitemapFile = '/sitemap.xml';
const axios = require('axios');
app.use(express.json({ limit: '100MB' }));
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

app.post('/estimator', (req, res) => {
  const url = req.body.url;
  console.log('url', url);
  var length = 0;
  var sitemaps = 0;
  var loopSitemaps = 0;
  var count = 0;
  let url1;
  let allURLs = [];
  let blogs = [];
  let pages = [];
  let pageData = {};
  let allImages = [];
  let allPageLinks = [];
  let countPages = 0;
  let pdfPages = [];
  let failedURLs = [];
  let headerURLs = [];

  // Get Sitemap content and parse it to DOM
  async function getSitemapURLs(sitemapFile, callback) {
    const sitemapURL = url + sitemapFile;
    console.log('checking sitemap exists:', sitemapURL);
    axios.get(sitemapURL)
      .then(function (response) {
        // handle success
        // console.log(response);
        var sitemapContent = response.data;
        console.log('siteContent: ');
        var XMLSitemap = parseXMLSitemap(sitemapContent);
        console.log('xml: ');
        sitemaps = XMLSitemap.getElementsByTagName('sitemap');
        // var subSitemapContent = undefined;
        console.log('sitemaps.length:', sitemaps.length);
        if (sitemaps !== undefined && sitemaps.length > 0) {
          for (var i = 0; i < sitemaps.length; i++) {
            console.log('subFileName: ', sitemaps[i].getElementsByTagName('loc')[0].textContent);
            axios.get(sitemaps[i].getElementsByTagName('loc')[0].textContent)
              .then(function (response) {
                loopSitemaps = loopSitemaps + 1;
                var subSitemapContent = response.data;
                var subXMLSitemap = parseXMLSitemap(subSitemapContent);
                console.log('sub: ', loopSitemaps, sitemaps.length);
                if (loopSitemaps == sitemaps.length) {
                  callback(subXMLSitemap, "pass");
                }
                else {
                  callback(subXMLSitemap);
                }
              })
          }
        }
        else {
          callback(XMLSitemap, "pass");
        }
      })
      .catch(function (error) {
        console.log('Calling nonsitemap fn:' + url);
        getNonSitemapURLS(url, url);
      })
  }

  // retrieving info from sitemap
  getSitemapURLs(sitemapFile, function (XMLSitemap, array_status) {
    try {
      var urls = XMLSitemap.getElementsByTagName('url');
      console.log('urls:', url);
      count++;
      if (urls.length == 0) {
        console.log("calling non site map as URL length in 0");
        getNonSitemapURLS(url, url);
      }
      else {
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
        console.log('pages: ', array_status, allURLs);
        length = length + urls.length;
        if (array_status == "pass") {
          console.log('Getting Images');
          allURLs.forEach((pageUrl) => {
            // console.log('pageUrl: ', pageUrl);
            getImages(pageUrl);
          });
        }
      }
    } catch (err) {
      console.log('err:', err);
    }
  });

  async function getNonSitemapURLS(url, url1) {
    try {
      console.log('url', url);
      const response = await axios.get(url1);
      if (response.status === 200) {
        const html = response.data;
        let $ = cheerio.load(html);
        console.log('link count:', $('a').length);
        $('a').each(function () {
          var link = $(this);
          var linkUrl = link.attr('href');
          if (linkUrl !== '' && linkUrl != null && linkUrl !== undefined) {
            var newURL = '';
            if (linkUrl.charAt(0) === '/' || !linkUrl.startsWith('http')) {
              if (linkUrl.charAt(0) === '/') {
                linkUrl = linkUrl.substring(1);
              }
              newURL = url + "/" + linkUrl.split('#')[0];
              console.log('newURL:', newURL);
              if (!allPageLinks.includes(newURL) && !newURL.includes('tel') && newURL.startsWith(url)) {
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
            } else if (!allPageLinks.includes(linkUrl) && linkUrl.startsWith(url) && !linkUrl.includes('tel')) {
              allPageLinks.push(linkUrl);
              if (
                linkUrl.includes('/tag/') ||
                linkUrl.includes('/categories/') ||
                linkUrl.includes('/post/') ||
                linkUrl.includes('/blog/')
              ) {
                blogs.push(linkUrl);
              } else {
                pages.push(linkUrl);
              }
            }
          }
        });
        allURLs = [];
        allURLs = allPageLinks;
        // console.log('allUrls length:', allURLs.length);
        // console.log('allURLs:', allURLs);
      }
      countPages = 0;
      allPageLinks.forEach((pageUrl) => {
        crawlnonsitemaparray(url, pageUrl, allPageLinks.length);
        // console.log("Crawling inner link: ", url, pageUrl, allPageLinks.length);
      });
      // res.send(pageData);
    } catch (err) {
      console.log('err:', url, err);
    }
  }

  async function crawlnonsitemaparray(url, pageUrl, len) {
    try {
      // console.log("Crawling inner link:", pageUrl, len)
      const response = await axios.get(pageUrl);
      if (response.status === 200) {
        const html = response.data;
        let $ = cheerio.load(html);
        // console.log('link count:', $('a').length);
        $('a').each(function () {
          var link = $(this);
          var linkUrl = link.attr('href');
          // console.log("found link: ", linkUrl);
          if (linkUrl !== '' && linkUrl != null && linkUrl !== undefined) {
            var newURL = '';
            if (linkUrl.charAt(0) === '/' || !linkUrl.startsWith('http')) {
              if (linkUrl.charAt(0) === '/') {
                linkUrl = linkUrl.substring(1);
              }
              newURL = url + "/" + linkUrl.split('#')[0];
              console.log('newURL:', newURL);
              if (!allURLs.includes(newURL) && !newURL.includes('tel') && newURL.startsWith(url)) {
                allURLs.push(newURL);
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
            } else if (!allURLs.includes(linkUrl) && linkUrl.startsWith(url) && !linkUrl.includes('tel')) {
              allURLs.push(linkUrl);
              if (
                linkUrl.includes('/tag/') ||
                linkUrl.includes('/categories/') ||
                linkUrl.includes('/post/') ||
                linkUrl.includes('/blog/')
              ) {
                blogs.push(linkUrl);
              } else {
                pages.push(linkUrl);
              }
            }
          }
        });
        // allURLs = [];
        countPages = countPages + 1;
        console.log("crawling page if: ", countPages);
      }
      else {
        countPages = countPages + 1;
        console.log("crawling page else: ", countPages);
      }
      if (countPages == len) {
        allURLs.forEach((pageUrl) => {
          // console.log('pageUrl: ', pageUrl);
          getImages(pageUrl);
        });
        console.log('Getting Images for non-sitemap');
        // console.log("H1 sent from Green:", pageUrl);
      }

    } catch (err) {
      countPages = countPages + 1;
      console.log("crawling page catch: ", countPages);
      // console.log('err:', pageUrl, err);
      if (countPages == len) {
        pageData = {
          allURLs: JSON.stringify(allURLs),
        };
        res.send(pageData);
      }
    }
  }

  async function getImages(pageUrl) {
    try {
      const response = await axios.get(pageUrl);
      if (response.status === 200) {
        const html = response.data;
        let $ = cheerio.load(html);
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
              // console.log(imageUrl);
            }
            // console.log('allImages Length:', allImages.length);
          }
        });
        countPages = countPages + 1;
        $ = "";
      }
      else {
        countPages += 1;
      }

      if (countPages === allURLs.length) {
        console.log(
          "allURLs", allURLs.length,
          "blogs", blogs.length,
          "pages", pages.length,
          "images", allImages.length,
          "pdfCount", pdfPages.length,
        );
        var dataCount = {
          "allURLs": allURLs.length,
          "blogs": blogs.length,
          "pages": pages.length,
          "images": allImages.length,
          "pdfCount": pdfPages.length,
        }
        //debugger;
        pageData = {
          allURLs: JSON.stringify(allURLs),
          blogs: JSON.stringify(blogs),
          pages: JSON.stringify(pages),
          images: JSON.stringify(allImages),
          pdfCount: JSON.stringify(pdfPages),
          dataCount: dataCount
        };
        // console.log('All Images:', allImages);
        res.send(pageData);
        console.log('response sent');
      }
    } catch (err) {
      countPages = countPages + 1;
      console.log('err:', err.response.url);
      // console.log('err:', err.response.statusCode);
      // console.log('Images:', allImages.length);
      if (countPages === allURLs.length) {
        var dataCount = {
          "allURLs": allURLs.length,
          "blogs": blogs.length,
          "pages": pages.length,
          "images": allImages.length,
          "pdfCount": pdfPages.length,
        }
        console.log(
          "allURLs", allURLs.length,
          "blogs", blogs.length,
          "pages", pages.length,
          "images", allImages.length,
          "pdfCount", pdfPages.length,
        );
        //debugger;
        pageData = {
          allURLs: JSON.stringify(allURLs),
          blogs: JSON.stringify(blogs),
          pages: JSON.stringify(pages),
          images: JSON.stringify(allImages),
          pdfCount: JSON.stringify(pdfPages),
          dataCount: dataCount
        };
        // console.log('All Images:', allImages);
        res.send(pageData);
        console.log('response sent');
      }
    }
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
