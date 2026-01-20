@echo off
REM ============================================
REM  Count Species in Tree
REM ============================================
REM
REM This script counts the number of species (leaf nodes)
REM in your tree data files.
REM
REM Usage:
REM   count-species.bat [optional-path-to-manifest-or-tree-file]
REM
REM If no path is provided, it will check:
REM   1. public/data/manifest.json (for split files)
REM   2. data/tree_opentree.json (for single tree file)
REM ============================================

cd /d "%~dp0.."
echo Current directory: %CD%
echo.

echo ============================================
echo Counting species in tree...
echo ============================================
echo.

if "%1"=="" (
    node tools/count-species-in-tree.js
) else (
    node tools/count-species-in-tree.js %1
)

if errorlevel 1 (
    echo.
    echo FAILED to count species
    pause
    exit /b 1
)

echo.
pause
