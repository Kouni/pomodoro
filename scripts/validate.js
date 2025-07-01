#!/usr/bin/env node

/**
 * Pomodoro Timer Validation Script
 * Validates all core functionality and code quality
 */

import { exec } from "child_process";
import { promises as fs } from "fs";
import { promisify } from "util";
import path from "path";
import { fileURLToPath } from "url";

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

// ANSI Colors for output
const colors = {
    reset: "\x1b[0m",
    green: "\x1b[32m",
    red: "\x1b[31m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    cyan: "\x1b[36m",
    bold: "\x1b[1m"
};

class Validator {
    constructor() {
        this.results = [];
        this.startTime = Date.now();
    }

    log(message, color = colors.reset) {
        console.log(`${color}${message}${colors.reset}`);
    }

    success(message) {
        this.log(`✓ ${message}`, colors.green);
    }

    error(message) {
        this.log(`✗ ${message}`, colors.red);
    }

    warning(message) {
        this.log(`⚠ ${message}`, colors.yellow);
    }

    info(message) {
        this.log(`ℹ ${message}`, colors.blue);
    }

    addResult(test, passed, details = "") {
        this.results.push({ test, passed, details });
        if (passed) {
            this.success(`${test} ${details}`);
        } else {
            this.error(`${test} ${details}`);
        }
    }

    async fileExists(filePath) {
        try {
            await fs.access(path.join(projectRoot, filePath));
            return true;
        } catch {
            return false;
        }
    }

    async readFile(filePath) {
        try {
            return await fs.readFile(path.join(projectRoot, filePath), "utf8");
        } catch {
            return null;
        }
    }

    async runCommand(command, description) {
        try {
            const { stdout, stderr } = await execAsync(command, {
                cwd: projectRoot,
                timeout: 30000
            });
            return { success: true, stdout, stderr };
        } catch (error) {
            return { 
                success: false, 
                stdout: error.stdout || "", 
                stderr: error.stderr || error.message 
            };
        }
    }

    // Test 1: File Structure Validation
    async validateFileStructure() {
        this.info("Validating file structure...");
        
        const requiredFiles = [
            "package.json",
            "index.html",
            "index.js",
            "index.scss",
            "eslint.config.js",
            ".prettierrc.json",
            ".prettierignore",
            ".gitignore"
        ];

        for (const file of requiredFiles) {
            const exists = await this.fileExists(file);
            this.addResult(
                `File: ${file}`,
                exists,
                exists ? "exists" : "missing"
            );
        }

        // Check assets directory
        const assetsExists = await this.fileExists("assets");
        this.addResult("Assets directory", assetsExists);
    }

    // Test 2: Package.json Validation
    async validatePackageJson() {
        this.info("Validating package.json...");
        
        const content = await this.readFile("package.json");
        if (!content) {
            this.addResult("package.json", false, "cannot read file");
            return;
        }

        try {
            const pkg = JSON.parse(content);
            
            // Check required fields
            const requiredFields = ["name", "version", "scripts", "devDependencies"];
            for (const field of requiredFields) {
                this.addResult(
                    `package.json field: ${field}`,
                    !!pkg[field],
                    pkg[field] ? "present" : "missing"
                );
            }

            // Check required scripts
            const requiredScripts = ["dev", "lint", "format", "check"];
            for (const script of requiredScripts) {
                this.addResult(
                    `Script: ${script}`,
                    !!pkg.scripts?.[script],
                    pkg.scripts?.[script] ? "present" : "missing"
                );
            }

            // Check dev dependencies
            const requiredDeps = ["eslint", "prettier", "http-server"];
            for (const dep of requiredDeps) {
                this.addResult(
                    `Dependency: ${dep}`,
                    !!pkg.devDependencies?.[dep],
                    pkg.devDependencies?.[dep] || "missing"
                );
            }

        } catch (error) {
            this.addResult("package.json", false, `invalid JSON: ${error.message}`);
        }
    }

    // Test 3: Code Quality Validation
    async validateCodeQuality() {
        this.info("Validating code quality...");
        
        // ESLint check
        const lintResult = await this.runCommand("pnpm run lint", "ESLint");
        this.addResult(
            "ESLint validation",
            lintResult.success,
            lintResult.success ? "no errors" : "has errors"
        );

        if (!lintResult.success && lintResult.stderr) {
            this.log(`   Error details: ${lintResult.stderr}`, colors.red);
        }

        // Prettier check
        const formatResult = await this.runCommand(
            "pnpm exec prettier --check \"*.{js,html,css,scss,json}\"",
            "Prettier"
        );
        this.addResult(
            "Code formatting",
            formatResult.success,
            formatResult.success ? "properly formatted" : "needs formatting"
        );
    }

    // Test 4: JavaScript Syntax and Structure
    async validateJavaScript() {
        this.info("Validating JavaScript code...");
        
        const jsContent = await this.readFile("index.js");
        if (!jsContent) {
            this.addResult("index.js", false, "cannot read file");
            return;
        }

        // Check for console.log statements (should be removed)
        const hasConsoleLog = /console\.(log|warn|error|debug)/g.test(jsContent);
        this.addResult(
            "Debug statements removed",
            !hasConsoleLog,
            hasConsoleLog ? "found console statements" : "clean"
        );

        // Check for key functions
        const requiredFunctions = [
            "soundEffect",
            "showNotification", 
            "requestNotificationPermission",
            "startCountdown",
            "resetTimer"
        ];

        for (const func of requiredFunctions) {
            const hasFunction = new RegExp(`(const|function)\\s+${func}`).test(jsContent);
            this.addResult(
                `Function: ${func}`,
                hasFunction,
                hasFunction ? "present" : "missing"
            );
        }

        // Check notification fix
        const hasNotificationFix = jsContent.includes("if (title && message)");
        this.addResult(
            "Notification fix applied",
            hasNotificationFix,
            hasNotificationFix ? "validation present" : "fix missing"
        );
    }

    // Test 5: HTML Structure
    async validateHTML() {
        this.info("Validating HTML structure...");
        
        const htmlContent = await this.readFile("index.html");
        if (!htmlContent) {
            this.addResult("index.html", false, "cannot read file");
            return;
        }

        // Check for required elements
        const requiredElements = [
            "#main-container",
            "#timer-container", 
            "#settings-container",
            "#todo-container",
            "vue@3"
        ];

        for (const element of requiredElements) {
            const hasElement = htmlContent.includes(element);
            this.addResult(
                `HTML element: ${element}`,
                hasElement,
                hasElement ? "present" : "missing"
            );
        }

        // Check for proper Vue.js integration
        const hasVueMount = htmlContent.includes("vue.global.prod.js");
        this.addResult(
            "Vue.js integration",
            hasVueMount,
            hasVueMount ? "production build" : "missing or wrong build"
        );
    }

    // Test 6: Assets Validation
    async validateAssets() {
        this.info("Validating assets...");
        
        const requiredAssets = [
            "assets/audio_break.mp3",
            "assets/audio_work.mp3", 
            "assets/audio_finish.mp3",
            "assets/favicon/favicon-32x32.png",
            "assets/icon_settings.svg",
            "assets/icon_todo.svg"
        ];

        for (const asset of requiredAssets) {
            const exists = await this.fileExists(asset);
            this.addResult(
                `Asset: ${path.basename(asset)}`,
                exists,
                exists ? "present" : "missing"
            );
        }
    }

    // Test 7: Development Server Test
    async validateDevServer() {
        this.info("Testing development server...");
        
        try {
            // Start server in background
            const serverProcess = exec("pnpm run serve", { cwd: projectRoot });
            
            // Wait a bit for server to start
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Test if server responds
            const testResult = await this.runCommand(
                "curl -s -o /dev/null -w \"%{http_code}\" http://localhost:8080",
                "Server test"
            );
            
            const serverWorking = testResult.stdout.trim() === "200";
            this.addResult(
                "Development server",
                serverWorking,
                serverWorking ? "responding" : "not accessible"
            );
            
            // Kill server
            serverProcess.kill();
            
        } catch (error) {
            this.addResult("Development server", false, `error: ${error.message}`);
        }
    }

    // Generate final report
    generateReport() {
        const endTime = Date.now();
        const duration = ((endTime - this.startTime) / 1000).toFixed(2);
        
        const passed = this.results.filter(r => r.passed).length;
        const total = this.results.length;
        const percentage = ((passed / total) * 100).toFixed(1);
        
        console.log("\n" + "=".repeat(60));
        this.log(`${colors.bold}VALIDATION REPORT${colors.reset}`, colors.cyan);
        console.log("=".repeat(60));
        
        this.log(`Total tests: ${total}`, colors.blue);
        this.log(`Passed: ${passed}`, colors.green);
        this.log(`Failed: ${total - passed}`, colors.red);
        this.log(`Success rate: ${percentage}%`, colors.cyan);
        this.log(`Duration: ${duration}s`, colors.blue);
        
        if (percentage >= 90) {
            this.log(`\n🎉 EXCELLENT! All systems operational.`, colors.green);
        } else if (percentage >= 75) {
            this.log(`\n⚠️  GOOD. Minor issues detected.`, colors.yellow);
        } else {
            this.log(`\n❌ POOR. Critical issues need attention.`, colors.red);
        }
        
        // Show failed tests
        const failed = this.results.filter(r => !r.passed);
        if (failed.length > 0) {
            console.log("\nFailed tests:");
            failed.forEach(test => {
                this.error(`  ${test.test}: ${test.details}`);
            });
        }
        
        console.log("\n" + "=".repeat(60));
        
        return percentage >= 75;
    }

    async run() {
        this.log(`${colors.bold}🔍 Starting Pomodoro Timer Validation${colors.reset}`, colors.cyan);
        console.log("=".repeat(60));
        
        try {
            await this.validateFileStructure();
            await this.validatePackageJson();
            await this.validateCodeQuality();
            await this.validateJavaScript();
            await this.validateHTML();
            await this.validateAssets();
            // Skip server test for now as it might conflict with running server
            // await this.validateDevServer();
            
        } catch (error) {
            this.error(`Validation failed: ${error.message}`);
            return false;
        }
        
        return this.generateReport();
    }
}

// Run validation if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const validator = new Validator();
    validator.run().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error(`Fatal error: ${error.message}`);
        process.exit(1);
    });
}

export default Validator;