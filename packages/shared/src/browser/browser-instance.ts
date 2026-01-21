/**
 * BrowserInstance - Playwright-based browser control
 *
 * Manages a single browser instance with takeover/handback state machine.
 * Provides methods for navigation, interaction, and screenshot capture.
 *
 * State Machine:
 *   IDLE ──launch──► AGENT ◄──handback── USER
 *                       │                   ▲
 *                       └───takeover────────┘
 *
 * - AGENT: Claude controls browser, tools work normally
 * - USER: Human controls via UI, agent tools blocked
 * - IDLE: Browser not launched
 */

// Playwright types - playwright is a peer dependency that must be installed by the application
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Browser = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BrowserContext = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Page = any

// Dynamic import of playwright - allows the module to be loaded without playwright being bundled
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let playwright: any = null

async function getPlaywright() {
  if (!playwright) {
    try {
      // Dynamic import with string variable to prevent TypeScript from resolving the module at compile time
      const moduleName = 'playwright'
      playwright = await import(/* @vite-ignore */ moduleName)
    } catch {
      throw new Error('Playwright is required for browser control. Install with: npm install playwright')
    }
  }
  return playwright
}

/**
 * Browser control state
 */
export type BrowserControlState = 'idle' | 'agent' | 'user'

/**
 * Viewport dimensions
 */
export interface Viewport {
  width: number
  height: number
}

/**
 * Browser instance configuration
 */
export interface BrowserInstanceConfig {
  /** Viewport dimensions (default: 1280x720) */
  viewport?: Viewport
  /** Whether to run headless (default: true) */
  headless?: boolean
  /** User agent string override */
  userAgent?: string
  /** Screenshot interval in ms for streaming (0 = disabled) */
  screenshotInterval?: number
  /** Callback for screenshot streaming */
  onScreenshot?: (imageBase64: string, controlState: BrowserControlState) => void
  /** Callback when URL changes */
  onNavigate?: (url: string, title?: string) => void
  /** Callback when control state changes */
  onControlChange?: (state: BrowserControlState) => void
  /** Callback for errors */
  onError?: (error: string) => void
  /** Callback when browser is closed */
  onClose?: () => void
}

/**
 * Result of a browser command
 */
export interface BrowserCommandResult {
  success: boolean
  error?: string
  imageBase64?: string
  title?: string
  value?: unknown
}

/**
 * Manages a Playwright browser instance with takeover/handback support
 */
export class BrowserInstance {
  private browser: Browser | null = null
  private context: BrowserContext | null = null
  private page: Page | null = null
  private controlState: BrowserControlState = 'idle'
  private screenshotIntervalId: ReturnType<typeof setInterval> | null = null
  private config: BrowserInstanceConfig

  constructor(config: BrowserInstanceConfig = {}) {
    this.config = {
      viewport: { width: 1280, height: 720 },
      headless: true,
      ...config,
    }
  }

  /**
   * Get current control state
   */
  getControlState(): BrowserControlState {
    return this.controlState
  }

  /**
   * Check if browser is active
   */
  isActive(): boolean {
    return this.browser !== null && this.page !== null
  }

  /**
   * Check if agent can perform actions (not in user takeover mode)
   */
  canAgentAct(): boolean {
    return this.controlState === 'agent'
  }

  /**
   * Launch browser and navigate to initial URL
   */
  async launch(initialUrl?: string): Promise<BrowserCommandResult> {
    try {
      if (this.browser) {
        return { success: false, error: 'Browser already launched' }
      }

      // Get playwright (dynamic import)
      const pw = await getPlaywright()

      // Launch browser
      this.browser = await pw.chromium.launch({
        headless: this.config.headless,
      })

      // Create context with viewport
      this.context = await this.browser.newContext({
        viewport: this.config.viewport,
        userAgent: this.config.userAgent,
      })

      // Create page
      this.page = await this.context.newPage()

      // Set up navigation listener
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.page.on('framenavigated', async (frame: any) => {
        if (frame === this.page?.mainFrame()) {
          const url = this.page?.url() || ''
          const title = await this.page?.title()
          this.config.onNavigate?.(url, title)
        }
      })

      // Set control state to agent
      this.setControlState('agent')

      // Navigate to initial URL if provided
      if (initialUrl) {
        await this.navigate(initialUrl)
      }

      // Start screenshot streaming if configured
      if (this.config.screenshotInterval && this.config.screenshotInterval > 0) {
        this.startScreenshotStreaming()
      }

      return { success: true }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      this.config.onError?.(errorMsg)
      return { success: false, error: errorMsg }
    }
  }

  /**
   * Navigate to a URL
   */
  async navigate(url: string): Promise<BrowserCommandResult> {
    if (!this.page) {
      return { success: false, error: 'Browser not launched' }
    }

    if (!this.canAgentAct()) {
      return { success: false, error: 'User has control of browser' }
    }

    // Validate URL
    if (!url || url.trim() === '') {
      return { success: false, error: 'URL is required' }
    }

    try {
      // Ensure URL has protocol
      const trimmedUrl = url.trim()
      const normalizedUrl = trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')
        ? trimmedUrl
        : `https://${trimmedUrl}`

      await this.page.goto(normalizedUrl, { waitUntil: 'domcontentloaded' })
      const title = await this.page.title()

      this.config.onNavigate?.(this.page.url(), title)
      return { success: true, title }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      this.config.onError?.(errorMsg)
      return { success: false, error: errorMsg }
    }
  }

  /**
   * Click an element or coordinates
   */
  async click(options: { selector?: string; x?: number; y?: number }): Promise<BrowserCommandResult> {
    if (!this.page) {
      return { success: false, error: 'Browser not launched' }
    }

    if (!this.canAgentAct()) {
      return { success: false, error: 'User has control of browser' }
    }

    try {
      if (options.selector) {
        await this.page.click(options.selector)
      } else if (options.x !== undefined && options.y !== undefined) {
        await this.page.mouse.click(options.x, options.y)
      } else {
        return { success: false, error: 'Must provide selector or coordinates' }
      }
      return { success: true }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      return { success: false, error: errorMsg }
    }
  }

  /**
   * Type text into an element or focused element
   */
  async type(text: string, options?: { selector?: string; pressEnter?: boolean }): Promise<BrowserCommandResult> {
    if (!this.page) {
      return { success: false, error: 'Browser not launched' }
    }

    if (!this.canAgentAct()) {
      return { success: false, error: 'User has control of browser' }
    }

    try {
      if (options?.selector) {
        await this.page.fill(options.selector, text)
      } else {
        await this.page.keyboard.type(text)
      }

      if (options?.pressEnter) {
        await this.page.keyboard.press('Enter')
      }

      return { success: true }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      return { success: false, error: errorMsg }
    }
  }

  /**
   * Scroll the page
   */
  async scroll(direction: 'up' | 'down', amount: number = 300): Promise<BrowserCommandResult> {
    if (!this.page) {
      return { success: false, error: 'Browser not launched' }
    }

    if (!this.canAgentAct()) {
      return { success: false, error: 'User has control of browser' }
    }

    try {
      const delta = direction === 'down' ? amount : -amount
      await this.page.mouse.wheel(0, delta)
      return { success: true }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      return { success: false, error: errorMsg }
    }
  }

  /**
   * Take a screenshot
   */
  async screenshot(): Promise<BrowserCommandResult> {
    if (!this.page) {
      return { success: false, error: 'Browser not launched' }
    }

    try {
      const buffer = await this.page.screenshot({ type: 'png' })
      const imageBase64 = buffer.toString('base64')
      return { success: true, imageBase64 }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      return { success: false, error: errorMsg }
    }
  }

  /**
   * Wait for a specified time
   */
  async wait(ms: number): Promise<BrowserCommandResult> {
    if (!this.page) {
      return { success: false, error: 'Browser not launched' }
    }

    try {
      await this.page.waitForTimeout(Math.min(ms, 30000))
      return { success: true }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      return { success: false, error: errorMsg }
    }
  }

  /**
   * Execute JavaScript in page context
   */
  async evaluate(script: string): Promise<BrowserCommandResult> {
    if (!this.page) {
      return { success: false, error: 'Browser not launched' }
    }

    if (!this.canAgentAct()) {
      return { success: false, error: 'User has control of browser' }
    }

    try {
      const value = await this.page.evaluate(script)
      return { success: true, value }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      return { success: false, error: errorMsg }
    }
  }

  /**
   * User takes over browser control
   * Agent tools will be blocked until handback
   */
  takeoverByUser(): void {
    if (this.controlState === 'agent') {
      this.setControlState('user')
    }
  }

  /**
   * User hands back control to agent
   */
  handBackToAgent(): void {
    if (this.controlState === 'user') {
      this.setControlState('agent')
    }
  }

  /**
   * Handle user input when in user control mode
   */
  async handleUserClick(x: number, y: number): Promise<void> {
    if (!this.page || this.controlState !== 'user') return
    await this.page.mouse.click(x, y)
  }

  /**
   * Handle user keyboard input when in user control mode
   */
  async handleUserKeypress(key: string, modifiers?: string[]): Promise<void> {
    if (!this.page || this.controlState !== 'user') return

    // Build key string with modifiers
    const keyCombo = modifiers && modifiers.length > 0
      ? `${modifiers.join('+')}+${key}`
      : key

    await this.page.keyboard.press(keyCombo)
  }

  /**
   * Close the browser
   */
  async close(): Promise<BrowserCommandResult> {
    try {
      this.stopScreenshotStreaming()

      if (this.page) {
        await this.page.close()
        this.page = null
      }

      if (this.context) {
        await this.context.close()
        this.context = null
      }

      if (this.browser) {
        await this.browser.close()
        this.browser = null
      }

      this.setControlState('idle')
      this.config.onClose?.()
      return { success: true }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      return { success: false, error: errorMsg }
    }
  }

  /**
   * Get current URL
   */
  getCurrentUrl(): string {
    return this.page?.url() || ''
  }

  /**
   * Get current page title
   */
  async getCurrentTitle(): Promise<string> {
    return this.page?.title() ?? ''
  }

  // Private helpers

  private setControlState(state: BrowserControlState): void {
    if (this.controlState !== state) {
      this.controlState = state
      this.config.onControlChange?.(state)
    }
  }

  private startScreenshotStreaming(): void {
    if (this.screenshotIntervalId) return

    const interval = this.config.screenshotInterval || 200 // Default 5 FPS

    this.screenshotIntervalId = setInterval(async () => {
      if (!this.page || !this.config.onScreenshot) return

      try {
        const result = await this.screenshot()
        if (result.success && result.imageBase64) {
          this.config.onScreenshot(result.imageBase64, this.controlState)
        }
      } catch {
        // Ignore screenshot errors during streaming
      }
    }, interval)
  }

  private stopScreenshotStreaming(): void {
    if (this.screenshotIntervalId) {
      clearInterval(this.screenshotIntervalId)
      this.screenshotIntervalId = null
    }
  }
}
