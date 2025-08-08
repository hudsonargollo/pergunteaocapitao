#!/usr/bin/env tsx

/**
 * Comprehensive Test Runner for AnimatedAIChat
 * 
 * Executes all test suites and generates comprehensive reports including:
 * - Unit tests for component functionality
 * - Integration tests for API connectivity
 * - Visual regression tests for theme consistency
 * - Accessibility tests for WCAG compliance
 * - Performance tests for animation smoothness
 * - Memory usage tests for efficiency
 * - Load tests for API integration
 * - Image consistency tests for brand compliance
 * - End-to-end tests for complete user flows
 */

import { execSync } from 'child_process'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

interface TestSuite {
  name: string
  file: string
  description: string
  category: 'unit' | 'integration' | 'visual' | 'accessibility' | 'performance' | 'e2e'
  timeout: number
  critical: boolean
}

interface TestResult {
  suite: string
  passed: number
  failed: number
  skipped: number
  duration: number
  coverage?: number
  errors: string[]
  warnings: string[]
}

interface ComprehensiveReport {
  timestamp: string
  totalSuites: number
  totalTests: number
  passedTests: number
  failedTests: number
  skippedTests: number
  totalDuration: number
  overallCoverage: number
  suiteResults: TestResult[]
  summary: {
    unit: { passed: number; failed: number; coverage: number }
    integration: { passed: number; failed: number; coverage: number }
    visual: { passed: number; failed: number; coverage: number }
    accessibility: { passed: number; failed: number; coverage: number }
    performance: { passed: number; failed: number; coverage: number }
    e2e: { passed: number; failed: number; coverage: number }
  }
  recommendations: string[]
  criticalIssues: string[]
}

class ComprehensiveTestRunner {
  private testSuites: TestSuite[] = [
    {
      name: 'Unit Tests',
      file: 'app/components/ui/__tests__/animated-ai-chat.test.tsx',
      description: 'Core component functionality and state management',
      category: 'unit',
      timeout: 30000,
      critical: true,
    },
    {
      name: 'Integration Tests',
      file: 'app/components/ui/__tests__/animated-ai-chat.integration.test.tsx',
      description: 'API connectivity and data flow integration',
      category: 'integration',
      timeout: 60000,
      critical: true,
    },
    {
      name: 'Visual Regression Tests',
      file: 'app/components/ui/__tests__/animated-ai-chat.visual.test.tsx',
      description: 'Cave theme consistency and visual elements',
      category: 'visual',
      timeout: 45000,
      critical: false,
    },
    {
      name: 'Accessibility Tests',
      file: 'app/components/ui/__tests__/animated-ai-chat.accessibility.test.tsx',
      description: 'WCAG 2.1 AA compliance and screen reader support',
      category: 'accessibility',
      timeout: 45000,
      critical: true,
    },
    {
      name: 'Performance Tests',
      file: 'app/components/ui/__tests__/animated-ai-chat.performance.test.tsx',
      description: 'Animation smoothness and 60fps performance',
      category: 'performance',
      timeout: 90000,
      critical: false,
    },
    {
      name: 'Memory Usage Tests',
      file: 'app/components/ui/__tests__/animated-ai-chat.memory.test.tsx',
      description: 'Memory efficiency and leak detection',
      category: 'performance',
      timeout: 120000,
      critical: false,
    },
    {
      name: 'Load Tests',
      file: 'app/components/ui/__tests__/animated-ai-chat.load.test.tsx',
      description: 'API integration under various load conditions',
      category: 'performance',
      timeout: 180000,
      critical: false,
    },
    {
      name: 'Image Consistency Tests',
      file: 'app/components/ui/__tests__/animated-ai-chat.image-consistency.test.tsx',
      description: 'Captain character consistency and brand compliance',
      category: 'integration',
      timeout: 90000,
      critical: false,
    },
    {
      name: 'End-to-End Tests',
      file: 'app/components/ui/__tests__/animated-ai-chat.e2e.test.tsx',
      description: 'Complete user journey and cross-browser compatibility',
      category: 'e2e',
      timeout: 120000,
      critical: true,
    },
  ]

  private results: TestResult[] = []
  private startTime: number = 0

  async runAllTests(options: {
    parallel?: boolean
    coverage?: boolean
    verbose?: boolean
    failFast?: boolean
    categories?: string[]
  } = {}): Promise<ComprehensiveReport> {
    console.log('🚀 Starting Comprehensive Test Suite for AnimatedAIChat\n')
    
    this.startTime = Date.now()
    const {
      parallel = false,
      coverage = true,
      verbose = false,
      failFast = false,
      categories = ['unit', 'integration', 'visual', 'accessibility', 'performance', 'e2e']
    } = options

    // Filter test suites by categories
    const suitesToRun = this.testSuites.filter(suite => 
      categories.includes(suite.category)
    )

    console.log(`📋 Running ${suitesToRun.length} test suites:\n`)
    suitesToRun.forEach(suite => {
      console.log(`  ${suite.critical ? '🔴' : '🟡'} ${suite.name} - ${suite.description}`)
    })
    console.log()

    if (parallel && suitesToRun.length > 1) {
      await this.runTestsInParallel(suitesToRun, { coverage, verbose, failFast })
    } else {
      await this.runTestsSequentially(suitesToRun, { coverage, verbose, failFast })
    }

    return this.generateComprehensiveReport()
  }

  private async runTestsSequentially(
    suites: TestSuite[],
    options: { coverage: boolean; verbose: boolean; failFast: boolean }
  ): Promise<void> {
    for (const suite of suites) {
      console.log(`\n🧪 Running ${suite.name}...`)
      
      try {
        const result = await this.runSingleTest(suite, options)
        this.results.push(result)

        if (result.failed > 0) {
          console.log(`❌ ${suite.name} failed with ${result.failed} failures`)
          
          if (options.failFast && suite.critical) {
            console.log('🛑 Stopping due to critical test failure (fail-fast mode)')
            break
          }
        } else {
          console.log(`✅ ${suite.name} passed (${result.passed} tests)`)
        }
      } catch (error) {
        console.error(`💥 ${suite.name} crashed:`, error)
        
        this.results.push({
          suite: suite.name,
          passed: 0,
          failed: 1,
          skipped: 0,
          duration: 0,
          errors: [error instanceof Error ? error.message : String(error)],
          warnings: [],
        })

        if (options.failFast && suite.critical) {
          break
        }
      }
    }
  }

  private async runTestsInParallel(
    suites: TestSuite[],
    options: { coverage: boolean; verbose: boolean; failFast: boolean }
  ): Promise<void> {
    console.log('⚡ Running tests in parallel...\n')

    const promises = suites.map(async (suite) => {
      try {
        const result = await this.runSingleTest(suite, options)
        console.log(`${result.failed > 0 ? '❌' : '✅'} ${suite.name} completed`)
        return result
      } catch (error) {
        console.error(`💥 ${suite.name} crashed:`, error)
        return {
          suite: suite.name,
          passed: 0,
          failed: 1,
          skipped: 0,
          duration: 0,
          errors: [error instanceof Error ? error.message : String(error)],
          warnings: [],
        }
      }
    })

    this.results = await Promise.all(promises)
  }

  private async runSingleTest(
    suite: TestSuite,
    options: { coverage: boolean; verbose: boolean }
  ): Promise<TestResult> {
    const startTime = Date.now()
    
    let command = `npx vitest run ${suite.file}`
    
    if (options.coverage) {
      command += ' --coverage'
    }
    
    if (options.verbose) {
      command += ' --reporter=verbose'
    } else {
      command += ' --reporter=json'
    }

    command += ` --testTimeout=${suite.timeout}`

    try {
      const output = execSync(command, {
        encoding: 'utf8',
        timeout: suite.timeout + 10000, // Add 10s buffer
        cwd: process.cwd(),
      })

      const duration = Date.now() - startTime
      return this.parseTestOutput(suite.name, output, duration)
    } catch (error: any) {
      const duration = Date.now() - startTime
      
      // Parse error output if available
      if (error.stdout) {
        return this.parseTestOutput(suite.name, error.stdout, duration)
      }

      return {
        suite: suite.name,
        passed: 0,
        failed: 1,
        skipped: 0,
        duration,
        errors: [error.message || 'Test execution failed'],
        warnings: [],
      }
    }
  }

  private parseTestOutput(suiteName: string, output: string, duration: number): TestResult {
    try {
      // Try to parse JSON output first
      const jsonMatch = output.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const testResult = JSON.parse(jsonMatch[0])
        
        return {
          suite: suiteName,
          passed: testResult.numPassedTests || 0,
          failed: testResult.numFailedTests || 0,
          skipped: testResult.numPendingTests || 0,
          duration,
          coverage: testResult.coverageMap ? this.calculateCoverage(testResult.coverageMap) : undefined,
          errors: testResult.testResults?.flatMap((r: any) => 
            r.assertionResults?.filter((a: any) => a.status === 'failed')?.map((a: any) => a.failureMessages).flat()
          ) || [],
          warnings: [],
        }
      }
    } catch (error) {
      // Fall back to text parsing
    }

    // Fallback text parsing
    const passedMatch = output.match(/(\d+) passed/)
    const failedMatch = output.match(/(\d+) failed/)
    const skippedMatch = output.match(/(\d+) skipped/)

    return {
      suite: suiteName,
      passed: passedMatch ? parseInt(passedMatch[1]) : 0,
      failed: failedMatch ? parseInt(failedMatch[1]) : 0,
      skipped: skippedMatch ? parseInt(skippedMatch[1]) : 0,
      duration,
      errors: this.extractErrors(output),
      warnings: this.extractWarnings(output),
    }
  }

  private calculateCoverage(coverageMap: any): number {
    if (!coverageMap) return 0

    let totalStatements = 0
    let coveredStatements = 0

    Object.values(coverageMap).forEach((file: any) => {
      if (file.s) {
        Object.values(file.s).forEach((count: any) => {
          totalStatements++
          if (count > 0) coveredStatements++
        })
      }
    })

    return totalStatements > 0 ? (coveredStatements / totalStatements) * 100 : 0
  }

  private extractErrors(output: string): string[] {
    const errors: string[] = []
    const errorPatterns = [
      /Error: (.+)/g,
      /AssertionError: (.+)/g,
      /TypeError: (.+)/g,
      /ReferenceError: (.+)/g,
    ]

    errorPatterns.forEach(pattern => {
      let match
      while ((match = pattern.exec(output)) !== null) {
        errors.push(match[1])
      }
    })

    return errors
  }

  private extractWarnings(output: string): string[] {
    const warnings: string[] = []
    const warningPatterns = [
      /Warning: (.+)/g,
      /WARN: (.+)/g,
      /console\.warn: (.+)/g,
    ]

    warningPatterns.forEach(pattern => {
      let match
      while ((match = pattern.exec(output)) !== null) {
        warnings.push(match[1])
      }
    })

    return warnings
  }

  private generateComprehensiveReport(): ComprehensiveReport {
    const totalDuration = Date.now() - this.startTime
    const totalTests = this.results.reduce((sum, r) => sum + r.passed + r.failed + r.skipped, 0)
    const passedTests = this.results.reduce((sum, r) => sum + r.passed, 0)
    const failedTests = this.results.reduce((sum, r) => sum + r.failed, 0)
    const skippedTests = this.results.reduce((sum, r) => sum + r.skipped, 0)

    const coverageResults = this.results.filter(r => r.coverage !== undefined)
    const overallCoverage = coverageResults.length > 0
      ? coverageResults.reduce((sum, r) => sum + (r.coverage || 0), 0) / coverageResults.length
      : 0

    const summary = this.generateCategorySummary()
    const recommendations = this.generateRecommendations()
    const criticalIssues = this.identifyCriticalIssues()

    const report: ComprehensiveReport = {
      timestamp: new Date().toISOString(),
      totalSuites: this.results.length,
      totalTests,
      passedTests,
      failedTests,
      skippedTests,
      totalDuration,
      overallCoverage,
      suiteResults: this.results,
      summary,
      recommendations,
      criticalIssues,
    }

    this.saveReport(report)
    this.printReport(report)

    return report
  }

  private generateCategorySummary() {
    const categories = ['unit', 'integration', 'visual', 'accessibility', 'performance', 'e2e']
    const summary: any = {}

    categories.forEach(category => {
      const categoryResults = this.results.filter(r => {
        const suite = this.testSuites.find(s => s.name === r.suite)
        return suite?.category === category
      })

      summary[category] = {
        passed: categoryResults.reduce((sum, r) => sum + r.passed, 0),
        failed: categoryResults.reduce((sum, r) => sum + r.failed, 0),
        coverage: categoryResults.length > 0
          ? categoryResults.reduce((sum, r) => sum + (r.coverage || 0), 0) / categoryResults.length
          : 0,
      }
    })

    return summary
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = []

    // Coverage recommendations
    const lowCoverageResults = this.results.filter(r => (r.coverage || 0) < 80)
    if (lowCoverageResults.length > 0) {
      recommendations.push(
        `Improve test coverage for: ${lowCoverageResults.map(r => r.suite).join(', ')}`
      )
    }

    // Performance recommendations
    const slowTests = this.results.filter(r => r.duration > 60000)
    if (slowTests.length > 0) {
      recommendations.push(
        `Optimize slow test suites: ${slowTests.map(r => r.suite).join(', ')}`
      )
    }

    // Error recommendations
    const errorResults = this.results.filter(r => r.errors.length > 0)
    if (errorResults.length > 0) {
      recommendations.push(
        `Address test errors in: ${errorResults.map(r => r.suite).join(', ')}`
      )
    }

    // Accessibility recommendations
    const accessibilityResult = this.results.find(r => r.suite === 'Accessibility Tests')
    if (accessibilityResult && accessibilityResult.failed > 0) {
      recommendations.push('Critical: Fix accessibility issues to ensure WCAG compliance')
    }

    return recommendations
  }

  private identifyCriticalIssues(): string[] {
    const criticalIssues: string[] = []

    // Critical test failures
    const criticalSuites = this.testSuites.filter(s => s.critical)
    criticalSuites.forEach(suite => {
      const result = this.results.find(r => r.suite === suite.name)
      if (result && result.failed > 0) {
        criticalIssues.push(`Critical test failure in ${suite.name}: ${result.failed} failed tests`)
      }
    })

    // Zero test coverage
    const zeroCoverageResults = this.results.filter(r => (r.coverage || 0) === 0)
    if (zeroCoverageResults.length > 0) {
      criticalIssues.push(
        `Zero test coverage detected in: ${zeroCoverageResults.map(r => r.suite).join(', ')}`
      )
    }

    // All tests failed
    const totalFailures = this.results.filter(r => r.passed === 0 && r.failed > 0)
    if (totalFailures.length > 0) {
      criticalIssues.push(
        `Complete test suite failures: ${totalFailures.map(r => r.suite).join(', ')}`
      )
    }

    return criticalIssues
  }

  private saveReport(report: ComprehensiveReport): void {
    const reportsDir = join(process.cwd(), 'test-reports')
    if (!existsSync(reportsDir)) {
      mkdirSync(reportsDir, { recursive: true })
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const reportPath = join(reportsDir, `comprehensive-test-report-${timestamp}.json`)
    
    writeFileSync(reportPath, JSON.stringify(report, null, 2))
    console.log(`\n📊 Comprehensive report saved to: ${reportPath}`)

    // Also save a summary report
    const summaryPath = join(reportsDir, 'latest-test-summary.json')
    const summary = {
      timestamp: report.timestamp,
      totalTests: report.totalTests,
      passedTests: report.passedTests,
      failedTests: report.failedTests,
      successRate: (report.passedTests / report.totalTests) * 100,
      overallCoverage: report.overallCoverage,
      duration: report.totalDuration,
      criticalIssues: report.criticalIssues.length,
      recommendations: report.recommendations.length,
    }
    
    writeFileSync(summaryPath, JSON.stringify(summary, null, 2))
  }

  private printReport(report: ComprehensiveReport): void {
    console.log('\n' + '='.repeat(80))
    console.log('📊 COMPREHENSIVE TEST REPORT')
    console.log('='.repeat(80))
    
    console.log(`\n📅 Timestamp: ${report.timestamp}`)
    console.log(`⏱️  Total Duration: ${(report.totalDuration / 1000).toFixed(2)}s`)
    console.log(`🧪 Total Tests: ${report.totalTests}`)
    console.log(`✅ Passed: ${report.passedTests} (${((report.passedTests / report.totalTests) * 100).toFixed(1)}%)`)
    console.log(`❌ Failed: ${report.failedTests} (${((report.failedTests / report.totalTests) * 100).toFixed(1)}%)`)
    console.log(`⏭️  Skipped: ${report.skippedTests} (${((report.skippedTests / report.totalTests) * 100).toFixed(1)}%)`)
    console.log(`📈 Overall Coverage: ${report.overallCoverage.toFixed(1)}%`)

    console.log('\n📋 SUITE BREAKDOWN:')
    console.log('-'.repeat(80))
    
    this.results.forEach(result => {
      const suite = this.testSuites.find(s => s.name === result.suite)
      const status = result.failed > 0 ? '❌' : '✅'
      const critical = suite?.critical ? '🔴' : '🟡'
      
      console.log(`${status} ${critical} ${result.suite}`)
      console.log(`    Passed: ${result.passed}, Failed: ${result.failed}, Duration: ${(result.duration / 1000).toFixed(2)}s`)
      
      if (result.coverage !== undefined) {
        console.log(`    Coverage: ${result.coverage.toFixed(1)}%`)
      }
      
      if (result.errors.length > 0) {
        console.log(`    Errors: ${result.errors.length}`)
      }
    })

    if (report.criticalIssues.length > 0) {
      console.log('\n🚨 CRITICAL ISSUES:')
      console.log('-'.repeat(80))
      report.criticalIssues.forEach(issue => {
        console.log(`🔴 ${issue}`)
      })
    }

    if (report.recommendations.length > 0) {
      console.log('\n💡 RECOMMENDATIONS:')
      console.log('-'.repeat(80))
      report.recommendations.forEach(rec => {
        console.log(`💡 ${rec}`)
      })
    }

    console.log('\n' + '='.repeat(80))
    
    const successRate = (report.passedTests / report.totalTests) * 100
    if (successRate >= 95) {
      console.log('🎉 EXCELLENT! Test suite is in great shape!')
    } else if (successRate >= 85) {
      console.log('👍 GOOD! Minor improvements needed.')
    } else if (successRate >= 70) {
      console.log('⚠️  NEEDS ATTENTION! Several issues to address.')
    } else {
      console.log('🚨 CRITICAL! Immediate attention required!')
    }
    
    console.log('='.repeat(80))
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2)
  const runner = new ComprehensiveTestRunner()

  const options = {
    parallel: args.includes('--parallel'),
    coverage: !args.includes('--no-coverage'),
    verbose: args.includes('--verbose'),
    failFast: args.includes('--fail-fast'),
    categories: args.includes('--categories') 
      ? args[args.indexOf('--categories') + 1]?.split(',') || []
      : undefined,
  }

  try {
    const report = await runner.runAllTests(options)
    
    // Exit with error code if there are critical issues or failures
    const hasFailures = report.failedTests > 0
    const hasCriticalIssues = report.criticalIssues.length > 0
    
    if (hasFailures || hasCriticalIssues) {
      process.exit(1)
    } else {
      process.exit(0)
    }
  } catch (error) {
    console.error('💥 Test runner crashed:', error)
    process.exit(1)
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
}

export { ComprehensiveTestRunner, type ComprehensiveReport }