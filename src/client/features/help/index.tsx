import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ThemeSwitch } from '@/components/theme-switch'
import { HelpIcon } from '@/components/icons/help-icon'
import { ChevronDown } from 'lucide-react'
import { useState } from 'react'

function FAQItem({
  question,
  answer,
}: {
  question: string
  answer: React.ReactNode
}) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border bg-card p-4 text-left font-medium hover:bg-muted/50 transition-colors">
        <span>{question}</span>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pt-3 pb-1 text-muted-foreground">
        {answer}
      </CollapsibleContent>
    </Collapsible>
  )
}

function Section({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-8">
      <h2 className="text-xl font-semibold mb-4 pb-2 border-b">{title}</h2>
      {children}
    </section>
  )
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="rounded-lg bg-zinc-900 text-zinc-100 p-4 text-sm font-mono overflow-x-auto">
      <code>{children}</code>
    </pre>
  )
}

function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-muted px-1.5 py-0.5 text-sm font-mono">
      {children}
    </code>
  )
}

HelpCenter.displayName = 'HelpCenter'

export function HelpCenter() {
  return (
    <>
      <Header>
        <div className="flex items-center gap-2">
          <HelpIcon active className="h-6 w-6" />
          <span className="font-semibold text-lg">Help Center</span>
        </div>
        <div className="ms-auto flex items-center space-x-4">
          <ThemeSwitch />
        </div>
      </Header>

      <Main>
        <div className="px-2">
      {/* Hero Header */}
      <div className="bg-red-500 text-white rounded-xl p-8 mb-8">
        <div className="max-w-2xl">
          <Badge variant="secondary" className="mb-4 bg-white/20 text-white hover:bg-white/30">
            Documentation
          </Badge>
          <h1 className="text-3xl font-bold mb-3">
            Welcome to Clawalytics
          </h1>
          <p className="text-lg text-white/90">
            Track your AI spending, monitor agent performance, and optimize your Claude Code usage — all in one dashboard.
          </p>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
        <a
          href="#getting-started"
          className="group rounded-lg border bg-card p-4 hover:border-primary hover:shadow-md transition-all"
        >
          <div className="text-2xl mb-2">🚀</div>
          <div className="font-medium group-hover:text-primary transition-colors">Getting Started</div>
          <div className="text-sm text-muted-foreground">Installation & setup</div>
        </a>
        <a
          href="#features"
          className="group rounded-lg border bg-card p-4 hover:border-primary hover:shadow-md transition-all"
        >
          <div className="text-2xl mb-2">✨</div>
          <div className="font-medium group-hover:text-primary transition-colors">Features</div>
          <div className="text-sm text-muted-foreground">What you can do</div>
        </a>
        <a
          href="#openclaw"
          className="group rounded-lg border bg-card p-4 hover:border-primary hover:shadow-md transition-all"
        >
          <div className="text-2xl mb-2">🦞</div>
          <div className="font-medium group-hover:text-primary transition-colors">OpenClaw</div>
          <div className="text-sm text-muted-foreground">Messaging integration</div>
        </a>
        <a
          href="#faq"
          className="group rounded-lg border bg-card p-4 hover:border-primary hover:shadow-md transition-all"
        >
          <div className="text-2xl mb-2">❓</div>
          <div className="font-medium group-hover:text-primary transition-colors">FAQ</div>
          <div className="text-sm text-muted-foreground">Common questions</div>
        </a>
      </div>

      {/* Main Content */}
      <div className="space-y-12 max-w-3xl">

        {/* Getting Started */}
        <Section id="getting-started" title="Getting Started">
          <div className="space-y-6">
            <div className="rounded-lg border bg-card p-6">
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">1</span>
                Install Clawalytics
              </h3>
              <p className="text-muted-foreground mb-4">
                Install globally using npm or pnpm:
              </p>
              <CodeBlock>npm install -g clawalytics</CodeBlock>
            </div>

            <div className="rounded-lg border bg-card p-6">
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">2</span>
                Start the Dashboard
              </h3>
              <p className="text-muted-foreground mb-4">
                Launch the server to begin tracking:
              </p>
              <CodeBlock>clawalytics start</CodeBlock>
              <p className="text-muted-foreground mt-4">
                Open <InlineCode>http://localhost:3001</InlineCode> in your browser.
              </p>
            </div>

            <div className="rounded-lg border bg-card p-6">
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">3</span>
                You're Done!
              </h3>
              <p className="text-muted-foreground">
                Clawalytics automatically detects Claude Code logs at <InlineCode>~/.claude/projects/</InlineCode>.
                Your usage data will appear as you use Claude Code.
              </p>
            </div>

            <div className="rounded-lg border-2 border-dashed border-muted p-6">
              <h4 className="font-medium mb-3">CLI Commands Reference</h4>
              <div className="space-y-2 text-sm">
                <div className="flex gap-4">
                  <InlineCode>clawalytics start</InlineCode>
                  <span className="text-muted-foreground">Start the dashboard</span>
                </div>
                <div className="flex gap-4">
                  <InlineCode>clawalytics config</InlineCode>
                  <span className="text-muted-foreground">View configuration</span>
                </div>
                <div className="flex gap-4">
                  <InlineCode>clawalytics path [dir]</InlineCode>
                  <span className="text-muted-foreground">Set custom log path</span>
                </div>
                <div className="flex gap-4">
                  <InlineCode>clawalytics status</InlineCode>
                  <span className="text-muted-foreground">Check service status</span>
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* Features */}
        <Section id="features" title="Features">
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border bg-card p-5">
                <div className="text-2xl mb-2">📊</div>
                <h4 className="font-semibold mb-2">Dashboard Overview</h4>
                <p className="text-sm text-muted-foreground">
                  See total costs, sessions count, token usage, and cache savings at a glance.
                  View 30-day spending trends and model usage breakdown.
                </p>
              </div>

              <div className="rounded-lg border bg-card p-5">
                <div className="text-2xl mb-2">📜</div>
                <h4 className="font-semibold mb-2">Session History</h4>
                <p className="text-sm text-muted-foreground">
                  Browse all coding sessions with details: project path, model used,
                  tokens consumed, and cost per session.
                </p>
              </div>

              <div className="rounded-lg border bg-card p-5">
                <div className="text-2xl mb-2">💰</div>
                <h4 className="font-semibold mb-2">Cost Tracking</h4>
                <p className="text-sm text-muted-foreground">
                  Track spending by time period (today, week, month, lifetime),
                  by model, and by project.
                </p>
              </div>

              <div className="rounded-lg border bg-card p-5">
                <div className="text-2xl mb-2">⚡</div>
                <h4 className="font-semibold mb-2">Cache Savings</h4>
                <p className="text-sm text-muted-foreground">
                  See how much you save with prompt caching. Cache reads cost
                  only 10% of regular input — that's 90% savings!
                </p>
              </div>
            </div>

            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-5">
              <h4 className="font-semibold mb-2 text-amber-800 dark:text-amber-200">💡 Understanding Cache Tokens</h4>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                <strong>Cache Write</strong> costs 1.25x the normal input price (first-time caching).
                <strong> Cache Read</strong> costs only 0.1x (reusing cached content).
                The dashboard shows your actual dollar savings from caching.
              </p>
            </div>
          </div>
        </Section>

        {/* OpenClaw */}
        <Section id="openclaw" title="OpenClaw Integration">
          <div className="space-y-6">
            <div className="rounded-lg bg-gradient-to-r from-rose-50 to-orange-50 dark:from-rose-950/30 dark:to-orange-950/30 border p-5">
              <p className="text-muted-foreground">
                <strong className="text-foreground">OpenClaw</strong> connects Claude to messaging platforms like WhatsApp, Telegram, and Slack.
                Clawalytics provides full analytics support for OpenClaw users.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border bg-card p-5">
                <div className="text-2xl mb-2">🤖</div>
                <h4 className="font-semibold mb-2">Agent Analytics</h4>
                <p className="text-sm text-muted-foreground">
                  Track costs per AI agent, view token usage breakdown,
                  daily trends, and cost distribution across agents.
                </p>
              </div>

              <div className="rounded-lg border bg-card p-5">
                <div className="text-2xl mb-2">💬</div>
                <h4 className="font-semibold mb-2">Channel Analytics</h4>
                <p className="text-sm text-muted-foreground">
                  Compare costs across WhatsApp, Telegram, Slack.
                  See message volumes and cost per message.
                </p>
              </div>

              <div className="rounded-lg border bg-card p-5">
                <div className="text-2xl mb-2">🛡️</div>
                <h4 className="font-semibold mb-2">Security Monitoring</h4>
                <p className="text-sm text-muted-foreground">
                  Monitor active devices, pending pairing requests,
                  security alerts, and connection history.
                </p>
              </div>

              <div className="rounded-lg border bg-card p-5">
                <div className="text-2xl mb-2">📋</div>
                <h4 className="font-semibold mb-2">Audit Log</h4>
                <p className="text-sm text-muted-foreground">
                  Complete audit trail of all actions. Filter by type,
                  entity, date. Export to CSV.
                </p>
              </div>
            </div>

            <div className="rounded-lg border bg-card p-5">
              <h4 className="font-semibold mb-3">Enable OpenClaw Integration</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Add these settings to <InlineCode>~/.clawalytics/config.yaml</InlineCode>:
              </p>
              <CodeBlock>{`# OpenClaw Integration
openClawEnabled: true
openClawPath: ~/.openclaw
securityAlertsEnabled: true
gatewayLogsPath: /tmp/openclaw`}</CodeBlock>
            </div>
          </div>
        </Section>

        {/* Configuration */}
        <Section id="configuration" title="Configuration">
          <div className="space-y-6">
            <p className="text-muted-foreground">
              Clawalytics stores configuration at <InlineCode>~/.clawalytics/config.yaml</InlineCode>
              and data at <InlineCode>~/.clawalytics/clawalytics.db</InlineCode>.
            </p>

            <div className="rounded-lg border bg-card p-5">
              <h4 className="font-semibold mb-3">Full Configuration Example</h4>
              <CodeBlock>{`# Claude Code log path
logPath: ~/.claude/projects

# OpenClaw integration (optional)
openClawEnabled: true
openClawPath: ~/.openclaw
securityAlertsEnabled: true
gatewayLogsPath: /tmp/openclaw`}</CodeBlock>
            </div>

            <div className="rounded-lg border-2 border-dashed border-muted p-5">
              <h4 className="font-medium mb-3">File Locations</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <InlineCode>~/.clawalytics/config.yaml</InlineCode>
                  <span className="text-muted-foreground">Configuration</span>
                </div>
                <div className="flex justify-between">
                  <InlineCode>~/.clawalytics/clawalytics.db</InlineCode>
                  <span className="text-muted-foreground">Database</span>
                </div>
                <div className="flex justify-between">
                  <InlineCode>~/.claude/projects/</InlineCode>
                  <span className="text-muted-foreground">Claude Code logs</span>
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* FAQ */}
        <Section id="faq" title="Frequently Asked Questions">
          <div className="space-y-3">
            <FAQItem
              question="How does Clawalytics calculate costs?"
              answer={
                <p>
                  Costs are calculated using official provider pricing based on input tokens,
                  output tokens, and cache tokens. Each model (Opus, Sonnet, Haiku, GPT-4, etc.)
                  has different rates.
                </p>
              }
            />
            <FAQItem
              question="Why is my dashboard empty?"
              answer={
                <div className="space-y-2">
                  <p>Check these common issues:</p>
                  <ol className="list-decimal list-inside space-y-1 ml-2">
                    <li>Make sure you've used Claude Code at least once</li>
                    <li>Verify the log path with <InlineCode>clawalytics config</InlineCode></li>
                    <li>Try setting a custom path: <InlineCode>clawalytics path ~/.claude/projects</InlineCode></li>
                  </ol>
                </div>
              }
            />
            <FAQItem
              question="How do I reset my data?"
              answer={
                <p>
                  Delete the database file: <InlineCode>rm ~/.clawalytics/clawalytics.db</InlineCode>.
                  Restart Clawalytics and it will create a fresh database.
                </p>
              }
            />
            <FAQItem
              question="Does Clawalytics send data anywhere?"
              answer={
                <p>
                  No. Everything runs locally on your machine. All data stays in your local
                  SQLite database. Nothing is ever sent to external servers.
                </p>
              }
            />
            <FAQItem
              question="What models are supported?"
              answer={
                <div>
                  <p className="mb-2">Clawalytics tracks costs for:</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li><strong>Anthropic:</strong> Claude Opus 4, Sonnet 4, Sonnet 3.5, Haiku 3.5</li>
                    <li><strong>OpenAI:</strong> GPT-4o, GPT-4o-mini</li>
                    <li><strong>Google:</strong> Gemini Pro, Gemini Flash</li>
                    <li><strong>DeepSeek:</strong> DeepSeek Chat, DeepSeek Coder</li>
                  </ul>
                </div>
              }
            />
            <FAQItem
              question="How do I change the port?"
              answer={
                <p>
                  Use <InlineCode>clawalytics start --port 3005</InlineCode> or set the
                  environment variable <InlineCode>PORT=3005 clawalytics start</InlineCode>.
                </p>
              }
            />
          </div>
        </Section>

        {/* Footer */}
        <div className="rounded-lg bg-muted/50 p-6 text-center">
          <p className="text-muted-foreground">
            Need more help? Check out the{' '}
            <a
              href="https://github.com/yourusername/clawalytics"
              className="text-primary hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub repository
            </a>
            {' '}or open an issue.
          </p>
        </div>
      </div>
        </div>
      </Main>
    </>
  )
}
