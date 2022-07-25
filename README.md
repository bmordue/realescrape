# Read me!

`curl https://espc.com/properties?p=1&ps=5&new=7`

Look for XHR to /list

DevTools copy as Fetch in console:

```
await fetch("https://espc.com/properties/search/list", {
    "credentials": "include",
    "headers": {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:95.0) Gecko/20100101 Firefox/95.0",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.5",
        "Content-Type": "application/json;charset=utf-8",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin"
    },
    "referrer": "https://espc.com/properties?p=3&ps=5&new=7",
    "body": "{\"page\":3,\"pageSize\":5,\"sortBy\":null,\"locations\":[{\"displayText\":\"Scotland\",\"key\":\"scotland\",\"category\":0}],\"radiuses\":[],\"school\":null,\"rental\":false,\"minBeds\":\"\",\"minPrice\":\"\",\"maxPrice\":\"\",\"new\":7,\"fixedPrice\":false,\"virtualTour\":false,\"underOffer\":false,\"featured\":false,\"exclusive\":false,\"orgId\":null,\"ptype\":[],\"freeText\":[],\"view\":\"list\",\"keywords\":[],\"epc\":[],\"sids\":[]}",
    "method": "POST",
    "mode": "cors"
});
```
