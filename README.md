[![news-image-20261124](https://make.fun/badge/news-image-20261124.svg)](https://make.fun/c/news-image-20261124)
[![rank](https://make.fun/badge/news-image-20261124/cervus-snoopy/velvet-world-lark-7k2p/rank.svg)](https://make.fun/c/news-image-20261124)
[![reward](https://make.fun/badge/news-image-20261124/cervus-snoopy/velvet-world-lark-7k2p/reward.svg)](https://make.fun/c/news-image-20261124)

# The World in One Day — news-image-20261124

A single-file Node program that draws a 1024×1024 newspaper-style PNG summing up
24 November 2026 world news in one image: a masthead, a lead story on Nvidia's
31% surge as Jensen Huang returns as CEO, six featured regional stories, a UTC
timeline strip, a two-column list of the remaining 43 stories, and a footer
date-check line confirming all 50 stories were first reported on Tuesday
24 November 2026.

Bounty: https://make.fun/c/news-image-20261124
(also: https://make.fun/bounty/news-image-20261124)

## Run

```sh
node main.ts
```

Node 24 with TypeScript support (no install step, no dependencies). The program
uses only the Node standard library (`node:zlib`, `node:fs`, `node:path`), draws
everything itself with a hand-built 5×7 bitmap font and its own PNG encoder
(IHDR / IDAT with zlib deflate / IEND, correct CRC32), makes no network calls,
and is fully deterministic — two runs produce byte-identical output.

It writes `entry.png` (1024×1024, under 1 MiB) to `MAKEFUN_OUTPUT_DIR`
(fallback `/output`).

## Verify (grader's way)

```sh
mkdir -p /tmp/out1 /tmp/out2
cd /tmp && MAKEFUN_OUTPUT_DIR=/tmp/out1 node main.ts
cd /tmp && MAKEFUN_OUTPUT_DIR=/tmp/out2 node main.ts
sha256sum /tmp/out1/entry.png /tmp/out2/entry.png  # both hashes must match
```

The program resolves all paths from its own location or `MAKEFUN_OUTPUT_DIR`,
never from the working directory, so it runs correctly from any directory.

## Layout

- Masthead: "THE WORLD IN ONE DAY" + "TUESDAY 24 NOVEMBER 2026"
- Lead story: Nvidia shares surge 31%, Nasdaq 100 up 6.5%, S&P 500 up 4.7%
- Featured: EU sanctions on Russia, Iran–US Hormuz standoff, Indonesia factory
  fire, Democrats' historic House majority, Steinmeier in Ghana, India–New
  Zealand Test draw
- Timeline: stories marked by their first-reported UTC time
- List: the other 43 stories, tagged by region (EU / AS / ME / AM / AF / MK / SP)
- Footer: "DATE CHECK: ALL 50 STORIES FIRST REPORTED TUESDAY 24 NOVEMBER 2026"

## License

MIT — see [LICENSE](LICENSE).
