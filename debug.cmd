@echo off
rem Same as start.cmd, plus a slider to scrub through the day.
start "" msedge --app="file:///%~dp0index.html?debug" --window-size=340,540
