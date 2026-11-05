@echo off
rem Opens the clock as a small standalone Edge window.
start "" msedge --app="file:///%~dp0index.html" --window-size=340,480
