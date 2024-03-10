const express = require('express');
const cheerio = require('cheerio');
const fetch = require('node-fetch');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 5000;
const baseURL = "https://gogoanime3.co/";

app.use(cors());

async function getAnime(id) {
    try {
        const response = await fetch(baseURL + "/category/" + id);
        const html = await response.text();
        const $ = cheerio.load(html);
        const animeData = {
            title: $("div.anime_info_body_bg h1").text(),
            image: $("div.anime_info_body_bg img").attr("src"),
            id: id,
            totalepisode: $("#episode_page").children("li").last().children("a").attr("ep_end")
        };

        $("div.anime_info_body_bg p.type").each(function (i, elem) {
            const $x = cheerio.load($(elem).html());
            let keyName = $x("span")
                .text()
                .toLowerCase()
                .replace(":", "")
                .trim()
                .replace(/ /g, "_");
            if (/released/g.test(keyName))
                animeData[keyName] = $(elem)
                    .html()
                    .replace(`<span>${$x("span").text()}</span>`, "");
            else if (keyName === "other_name")
                animeData["Othername"] = $x("a").text().trim() || null;
            else if (keyName === "genre")
                animeData["genres"] = $x("a")
                    .map((i, el) => $(el).text().trim())
                    .get()
                    .join(", ")
                    .replace(/,\s+/g, ", ") || null;
            else
                animeData[keyName] = $x("a").text().trim() || null;
        });

        animeData.summary = $("div.description").text().trim();

        const animeid = $("input#movie_id").attr("value");
        const episodesResponse = await fetch(
            "https://ajax.gogocdn.net/ajax/load-list-episode?ep_start=0&ep_end=1000000&id=" +
            animeid
        );
        const episodesHTML = await episodesResponse.text();
        const episodes$ = cheerio.load(episodesHTML);

        let episodes = [];
        for (const element of episodes$("ul#episode_related a")) {
            const name = episodes$(element)
                .find("div")
                .text()
                .trim()
                .split(" ")[1]
                .slice(0, -3);
            const link = episodes$(element).attr("href").trim().slice(1);
            episodes.push([name, link]);
        }
        episodes = episodes.reverse();
        animeData.episodes = episodes;

        return animeData;
    } catch (error) {
        throw new Error("An error occurred while fetching anime details.");
    }
}

app.get("/api/details/:id", async (req, res) => {
    try {
        const animeData = await getAnime(req.params.id);
        // Remove the 'plot_summary' key if its value is null
        if (animeData.plot_summary === null) {
            delete animeData.plot_summary;
        }
        res.status(200).json(animeData);
    } catch (error) {
        res.status(404).json({ error: error.message });
    }
});
/*
Need to change getSearchDom variables to more general term.
The variable was used first while i was testing the scraping
and it was copy pasted to other routes
*/

app.get("/api/search/:word/:page", (req, res) => {
  let results = [];
  var word = req.params.word;
  let page = req.params.page;
  if (isNaN(page)) {
    return res.status(404).json({ results });
  }

  url = `${baseURL}/search.html?keyword=${word}&page=${req.params.page}`;
  rs(url, (err, resp, html) => {
    if (!err) {
      try {
        var $ = cheerio.load(html);
        $(".img").each(function (index, element) {
          let title = $(this).children("a").attr().title;
          let id = $(this).children("a").attr().href.slice(10);
          let image = $(this).children("a").children("img").attr().src;

          results[index] = { title, id, image };
        });
        res.status(200).json({ results });
      } catch (e) {
        res.status(404).json({ e: "404 fuck off!!!!!" });
      }
    }
  });
});

async function getLink(Link) {
  rs(Link, (err, resp, html) => {
    if (!err) {
      var $ = cheerio.load(html);
      let links = [];
      $("a").each((i, e) => {
        if (e.attribs.download === "") {
          links.push(e.attribs.href);
        }
      });
      return links;
    }
  });
}

app.get("/api/watching/:id/:episode", (req, res) => {
  let link = "";
  let nl = [];
  var totalepisode = [];
  var id = req.params.id;
  var episode = req.params.episode;
  url = `${baseURL + id}-episode-${episode}`;
  rs(url, async (err, resp, html) => {
    if (!err) {
      try {
        var $ = cheerio.load(html);

        if ($(".entry-title").text() === "404") {
          return res
            .status(404)
            .json({ links: [], link, totalepisode: totalepisode });
        }

        totalepisode = $("#episode_page")
          .children("li")
          .last()
          .children("a")
          .text()
          .split("-");
        totalepisode = totalepisode[totalepisode.length - 1];
        link = $("li.anime").children("a").attr("data-video");
        const cl = "http:" + link.replace("streaming.php", "download");
        rs(cl, (err, resp, html) => {
          if (!err) {
            try {
              var $ = cheerio.load(html);
              $("a").each((i, e) => {
                if (e.attribs.download === "") {
                  var li = e.children[0].data
                    .slice(21)
                    .replace("(", "")
                    .replace(")", "")
                    .replace(" - mp4", "");
                  nl.push({
                    src: e.attribs.href,
                    size: li == "HDP" ? "High Speed" : li,
                  });
                }
              });
              return res
                .status(200)
                .json({ links: nl, link, totalepisode: totalepisode });
            } catch (e) {
              return res
                .status(200)
                .json({ links: nl, link, totalepisode: totalepisode });
            }
          }
        });
      } catch (e) {
        return res
          .status(404)
          .json({ links: [], link: "", totalepisode: totalepisode });
      }
    }
  });
});

app.get('/api/iframe/:name_episode', (req, res) => {
    const url = `https://goone.pro/videos/${req.params.name_episode}`
    axios.get(url,{ headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.45 Safari/537.36' }  })
        .then((res) => res.data)
        .then((data) => {
            let iframe_link = ''
            getSearchDom = new DOMParser().parseFromString(data, 'text/html')
            iframe_link = getSearchDom.getElementsByTagName('iframe')[0].getAttribute('src').slice(2)
            res.send(iframe_link)
        })
        .catch((e) => console.log(e))
})

app.get("/api/genre/:type/:page", (req, res) => {
  var results = [];
  var type = req.params.type;
  var page = req.params.page;
  if (isNaN(page)) {
    return res.status(404).json({ results });
  }
  url = `${baseURL}genre/${type}?page=${page}`;
  rs(url, (err, resp, html) => {
    if (!err) {
      try {
        var $ = cheerio.load(html);
        $(".img").each(function (index, element) {
          let title = $(this).children("a").attr().title;
          let id = $(this).children("a").attr().href.slice(10);
          let image = $(this).children("a").children("img").attr().src;

          results[index] = { title, id, image };
        });

        res.status(200).json({ results });
      } catch (e) {
        res.status(404).json({ e: "404 fuck off!!!!!" });
      }
    }
  });
});

app.get("/api/genrelist", (req, res) => {
  var list = [];

  let url = baseURL;
  rs(url, (err, resp, html) => {
    if (!err) {
      try {
        var $ = cheerio.load(html);
        $("nav.genre")
          .children("ul")
          .children("li")
          .each(function (index, element) {
            list[index] = $(this).text();
          });

        res.status(200).json({ list });
      } catch (e) {
        res.status(404).json({ e: "404 fuck off!!!!!" });
      }
    }
  });
});

app.get("/api/list/:variable/:page", (req, res) => {
  var list = [];
  var page = req.params.page;

  if (isNaN(page)) {
    return res.status(404).json({ list });
  }
  var alphabet = req.params.variable;
  let url = `${baseURL}anime-list.html?page=${page}`;

  if (alphabet !== "all") {
    url = `${baseURL}anime-list-${alphabet}?page=${page}`;
  }

  rs(url, (err, resp, html) => {
    if (!err) {
      try {
        var $ = cheerio.load(html);
        $("ul.listing")
          .children("li")
          .each(function (index, element) {
            let title = $(this).children("a").text();

            let id = $(this).children("a").attr().href.slice(10);

            list[index] = { title, id };
          });

        res.status(200).json({ list });
      } catch (e) {
        res.status(404).json({ e: "404 fuck off!!!!!" });
      }
    }
  });
});

app.get('/api/anime/:name', (req, res) => {
    const url = `https://goone.pro/videos/${req.params.name}`
    axios.get(url,{ headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.45 Safari/537.36' }  })
        .then((res) => res.data)
        .then((data) => {
            let anime = {}
            getSearchDom = new DOMParser().parseFromString(data, 'text/html')
            
            // way attribute selector yawa
            let img = getSearchDom.getElementsByTagName('meta')[5].getAttribute('content')
            anime.img = img

            let episodes = []
            Array.from(getSearchDom.getElementsByClassName('listing items lists')[0].getElementsByClassName('name')).forEach(x => episodes.push(x.innerHTML.trim()))
            anime.episodes = episodes

            let links = []
            Array.from(getSearchDom.getElementsByClassName('listing items lists')[0].getElementsByClassName('video-block')).forEach(x => links.push(                
                `${x.getElementsByTagName('a')[0].getAttribute('href')}`
                ))
            anime.links = links

            let dates = []
            Array.from(getSearchDom.getElementsByClassName('listing items lists')[0].getElementsByClassName('date')).forEach(x => dates.push(x.innerHTML.trim()))
            anime.dates = dates

            //description returned with p tags
            let description = getSearchDom.getElementById('rmjs-1').innerHTML.trim()
            anime.description = description

			let type = getSearchDom.getElementsByClassName('type')[0].textContent
			anime.type = type
			
            res.send(anime)
        })
        .catch((e) => {
            console.log(e)
            res.send(e)
        })

})


app.get('/api/recently-added-sub', (req, res) => {
    const url = req.query.page ? `https://goone.pro/?page=${req.query.page}` : `https://goone.pro`
    axios.get(url,{ headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.45 Safari/537.36' }  })
        .then((res) => res.data)
        .then((data) => {
            getSearchDom = new DOMParser().parseFromString(data, 'text/html')
            let list = []
            Array.from(getSearchDom.getElementsByClassName('video-block')).forEach(element => {
                list.push({
                    img: element.getElementsByTagName('img')[0].getAttribute('src'),
                    name: myTrimAndSlice(element.getElementsByClassName('name')[0].innerHTML),
                    link: `${element.getElementsByTagName('a')[0].getAttribute('href')}`,
                    date: myTrimAndSlice(element.getElementsByClassName('date')[0].innerHTML)
                    
                })
            })
            res.send(list)
        })
        .catch((e) => console.log(e))
})

app.get('/api/recently-added-raw', (req, res) => {
    const url = req.query.page ? `https://goone.pro/recently-added-raw?page=${req.query.page}` : `https://goone.pro/recently-added-raw`
    axios.get(url,{ headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.45 Safari/537.36' }  })
        .then((res) => res.data)
        .then((data) => {
            getSearchDom = new DOMParser().parseFromString(data, 'text/html')
            let list = []
            Array.from(getSearchDom.getElementsByClassName('video-block')).forEach(element => {
                list.push({
                    img: element.getElementsByTagName('img')[0].getAttribute('src'),
                    name: myTrimAndSlice(element.getElementsByClassName('name')[0].innerHTML),
                    link: `${element.getElementsByTagName('a')[0].getAttribute('href')}`,
                    date: myTrimAndSlice(element.getElementsByClassName('date')[0].innerHTML)
                })
            })
            res.send(list)
        })
        .catch((e) => console.log(e))

})
app.get('/api/recently-added-dub', (req, res) => {
    const url = req.query.page ? `https://goone.pro/recently-added-dub?page=${req.query.page}` : `https://goone.pro/recently-added-dub`
    axios.get(url,{ headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.45 Safari/537.36' }  })
        .then((res) => res.data)
        .then((data) => {
            getSearchDom = new DOMParser().parseFromString(data, 'text/html')
            let list = []
            Array.from(getSearchDom.getElementsByClassName('video-block')).forEach(element => {
                list.push({
                    img: element.getElementsByTagName('img')[0].getAttribute('src'),
                    name: myTrimAndSlice(element.getElementsByClassName('name')[0].innerHTML),
                    link: `${element.getElementsByTagName('a')[0].getAttribute('href')}`,
                    date: myTrimAndSlice(element.getElementsByClassName('date')[0].innerHTML)
                })
            })
            res.send(list)
        })
        .catch((e) => console.log(e))

})
app.get('/api/movies', (req, res) => {
    const url = req.query.page ? `https://goone.pro/movies?page=${req.query.page}` : `https://goone.pro/movies`
    axios.get(url,{ headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.45 Safari/537.36' }  })
        .then((res) => res.data)
        .then((data) => {
            getSearchDom = new DOMParser().parseFromString(data, 'text/html')
            let list = []
            Array.from(getSearchDom.getElementsByClassName('video-block')).forEach(element => {
                list.push({
                    img: element.getElementsByTagName('img')[0].getAttribute('src'),
                    name: myTrimAndSlice(element.getElementsByClassName('name')[0].innerHTML),
                    link: `${element.getElementsByTagName('a')[0].getAttribute('href')}`,
                    date: myTrimAndSlice(element.getElementsByClassName('date')[0].innerHTML)
                })
            })
            res.send(list)
        })
        .catch((e) => console.log(e))

})

app.get('/api/new-season', (req, res) => {
    const url = req.query.page ? `https://goone.pro/new-season?page=${req.query.page}` : `https://goone.pro/new-season`
    axios.get(url,{ headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.45 Safari/537.36' }  })
        .then((res) => res.data)
        .then((data) => {
            getSearchDom = new DOMParser().parseFromString(data, 'text/html')
            let list = []
            Array.from(getSearchDom.getElementsByClassName('video-block')).forEach(element => {
                list.push({
                    img: element.getElementsByTagName('img')[0].getAttribute('src'),
                    name: myTrimAndSlice(element.getElementsByClassName('name')[0].innerHTML),
                    link: `${element.getElementsByTagName('a')[0].getAttribute('href')}`,
                    date: myTrimAndSlice(element.getElementsByClassName('date')[0].innerHTML)
                })
            })
            res.send(list)
        })
        .catch((e) => console.log(e))

})

app.get('/api/popular', (req, res) => {
    const url = req.query.page ? `https://goone.pro/popular?page=${req.query.page}` : `https://goone.pro/popular`
    axios.get(url,{ headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.45 Safari/537.36' }  })
        .then((res) => res.data)
        .then((data) => {
            getSearchDom = new DOMParser().parseFromString(data, 'text/html')
            let list = []
            Array.from(getSearchDom.getElementsByClassName('video-block')).forEach(element => {
                list.push({
                    img: element.getElementsByTagName('img')[0].getAttribute('src'),
                    name: myTrimAndSlice(element.getElementsByClassName('name')[0].innerHTML),
                    link: `${element.getElementsByTagName('a')[0].getAttribute('href')}`,
                    date: myTrimAndSlice(element.getElementsByClassName('date')[0].innerHTML)
                })
            })
            res.send(list)
        })
        .catch((e) => console.log(e))

})

app.get("/api/homepopular/:page", (req, res) => {
  let results = [];
  let page = req.params.page;
  if (isNaN(page)) {
    return res.status(404).json({ results });
  }
  url = `${baseURL}popular.html?page=${req.params.page}`;
  rs(url, (error, response, html) => {
    if (!error) {
      try {
        var $ = cheerio.load(html);
        $(".img").each(function (index, element) {
          let title = $(this).children("a").attr().title;
          let id = $(this).children("a").attr().href.slice(10);
          let image = $(this).children("a").children("img").attr().src;

          results[index] = { title, id, image };
        });
        res.status(200).json({ results });
      } catch (e) {
        res.status(404).json({ e: "404 fuck off!!!!!" });
      }
    }
  });
});

app.get('/api/ongoing-series', (req, res) => {
    const url = req.query.page ? `https://goone.pro/ongoing-series?page=${req.query.page}` : `https://goone.pro/ongoing-series`
    axios.get(url,{ headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.45 Safari/537.36' }  })
        .then((res) => res.data)
        .then((data) => {
            getSearchDom = new DOMParser().parseFromString(data, 'text/html')
            let list = []
            Array.from(getSearchDom.getElementsByClassName('video-block')).forEach(element => {
                list.push({
                    img: element.getElementsByTagName('img')[0].getAttribute('src'),
                    name: myTrimAndSlice(element.getElementsByClassName('name')[0].innerHTML),
                    link: `${element.getElementsByTagName('a')[0].getAttribute('href')}`,
                    date: myTrimAndSlice(element.getElementsByClassName('date')[0].innerHTML)
                })
            })
            res.send(list)
        })
        .catch((e) => console.log(e))

})

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
})
