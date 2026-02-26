@echo off
REM School Admin Portal - GitHub Deployment for khushi_public_school

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║  School Admin Portal - GitHub Deployment                  ║
echo ║  GitHub: khushi_public_school                             ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

echo Step 1: Configure Git
git config --global user.name "Khushi Public School"
git config --global user.email "admin@khushistool.com"
echo ✓ Git configured
echo.

echo Step 2: Stage Files
git add .
echo ✓ Files staged
echo.

echo Step 3: Create Commit
git commit -m "Initial commit: School Admin Portal - Students, Teachers, Attendance, Payments Database"
echo ✓ Commit created
echo.

echo Step 4: Set Main Branch
git branch -M main
echo ✓ Branch set to main
echo.

echo Step 5: Connect to GitHub
echo IMPORTANT: Make sure you created the repository first!
echo Go to: https://github.com/new
echo Create repo name: school-admin-portal
echo Then continue...
pause

git remote add origin https://github.com/khushi_public_school/school-admin-portal.git
echo ✓ GitHub remote added
echo.

echo Step 6: Push to GitHub (starting upload...)
git push -u origin main

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║  ✓ Successfully Deployed to GitHub!                       ║
echo ╚════════════════════════════════════════════════════════════╝
echo.
echo View your repository:
echo https://github.com/khushi_public_school/school-admin-portal
echo.
pause
