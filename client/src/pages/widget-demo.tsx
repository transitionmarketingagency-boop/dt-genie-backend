import { useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, ExternalLink } from "lucide-react";
import { useState } from "react";

export default function WidgetDemo() {
  const [copied, setCopied] = useState(false);
  const [copiedFramer, setCopiedFramer] = useState(false);

  const embedCode = `<!-- DT Genie Chatbot Widget -->
<link rel="stylesheet" href="https://your-replit-url.replit.app/widget.css">
<script src="https://your-replit-url.replit.app/widget.js"></script>`;

  const framerCode = `<link rel="stylesheet" href="https://your-replit-url.replit.app/widget.css">
<script src="https://your-replit-url.replit.app/widget.js"></script>`;

  const handleCopy = async (text: string, setFunc: (val: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(text);
      setFunc(true);
      setTimeout(() => setFunc(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  useEffect(() => {
    // Load widget styles
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/widget.css';
    document.head.appendChild(link);

    // Load widget script
    const script = document.createElement('script');
    script.src = '/widget.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.head.removeChild(link);
      document.body.removeChild(script);
      // Clean up widget
      const widget = document.getElementById('dt-genie-widget');
      if (widget) widget.remove();
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12 max-w-6xl">
        {/* Hero */}
        <div className="text-center mb-12">
          <Badge className="mb-4" data-testid="badge-widget">
            <span className="mr-2">✨</span>
            DT Genie Widget Demo
          </Badge>
          <h1 className="text-4xl font-bold mb-4" data-testid="text-demo-title">
            AI Chatbot Widget
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Premium neon-themed chatbot with curved text animation. Click the widget in the bottom-right corner to try it!
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <Card className="p-6 text-center">
            <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🎨</span>
            </div>
            <h3 className="font-semibold mb-2">Neon Design</h3>
            <p className="text-sm text-muted-foreground">
              Glass-morphism with blue/orange glow effects
            </p>
          </Card>

          <Card className="p-6 text-center">
            <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🔄</span>
            </div>
            <h3 className="font-semibold mb-2">Curved Text</h3>
            <p className="text-sm text-muted-foreground">
              Animated "We are here" text around avatar
            </p>
          </Card>

          <Card className="p-6 text-center">
            <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🤖</span>
            </div>
            <h3 className="font-semibold mb-2">AI Powered</h3>
            <p className="text-sm text-muted-foreground">
              Smart responses trained on your business
            </p>
          </Card>
        </div>

        {/* Demo Section */}
        <Card className="p-8 mb-12 bg-muted/30">
          <h2 className="text-2xl font-bold mb-4" data-testid="text-try-section">
            Try It Now
          </h2>
          <p className="text-muted-foreground mb-6">
            Look for the floating DT Genie button in the bottom-right corner. Click it to start chatting!
          </p>
          <div className="bg-card border-2 border-dashed border-border rounded-lg p-12 text-center min-h-[300px] flex flex-col items-center justify-center">
            <div className="text-6xl mb-4">👉</div>
            <p className="text-lg font-medium mb-2">Widget appears in bottom-right</p>
            <p className="text-sm text-muted-foreground">Scroll down if you don't see it</p>
          </div>
        </Card>

        {/* Framer Integration */}
        <Card className="p-8 mb-8 border-primary/20">
          <div className="flex items-start gap-4 mb-6">
            <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <ExternalLink className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-2">Integrate with Framer</h2>
              <p className="text-muted-foreground">
                Add this chatbot to your Framer website in 3 easy steps
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-muted/50 rounded-lg p-6">
              <h3 className="font-semibold mb-3">Step 1: Get Your Replit URL</h3>
              <p className="text-sm text-muted-foreground mb-2">
                Your chatbot is running at: <code className="bg-muted px-2 py-1 rounded">https://your-replit-name.replit.app</code>
              </p>
              <p className="text-sm text-muted-foreground">
                Replace "your-replit-name" with your actual Replit project URL
              </p>
            </div>

            <div className="bg-muted/50 rounded-lg p-6">
              <h3 className="font-semibold mb-3">Step 2: Add Custom Code to Framer</h3>
              <ol className="text-sm text-muted-foreground space-y-2 mb-4 list-decimal list-inside">
                <li>Open your Framer project</li>
                <li>Go to <strong>Settings → General → Custom Code</strong></li>
                <li>Scroll to <strong>"End of &lt;body&gt; tag"</strong></li>
                <li>Paste the code below</li>
              </ol>
              
              <div className="relative">
                <pre className="bg-card p-4 rounded-lg overflow-x-auto text-xs border">
                  <code>{framerCode}</code>
                </pre>
                <Button
                  size="sm"
                  variant="secondary"
                  className="absolute top-2 right-2"
                  onClick={() => handleCopy(framerCode, setCopiedFramer)}
                  data-testid="button-copy-framer"
                >
                  {copiedFramer ? (
                    <>
                      <Check className="h-4 w-4 mr-1" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-1" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-6">
              <h3 className="font-semibold mb-3">Step 3: Publish Your Site</h3>
              <p className="text-sm text-muted-foreground">
                Click <strong>Publish</strong> in Framer and the chatbot widget will appear on your live site!
              </p>
            </div>

            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
              <p className="text-sm font-medium mb-2">💡 Pro Tip:</p>
              <p className="text-sm text-muted-foreground">
                The widget automatically adapts to your site's theme and works on all devices. No extra configuration needed!
              </p>
            </div>
          </div>
        </Card>

        {/* Generic Embed */}
        <Card className="p-8">
          <h2 className="text-2xl font-bold mb-4">Embed on Any Website</h2>
          <p className="text-muted-foreground mb-6">
            Works on WordPress, HTML, or any website. Just paste before the closing &lt;/body&gt; tag:
          </p>
          
          <div className="relative">
            <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs border max-h-[200px]">
              <code>{embedCode}</code>
            </pre>
            <Button
              size="sm"
              variant="secondary"
              className="absolute top-2 right-2"
              onClick={() => handleCopy(embedCode, setCopied)}
              data-testid="button-copy-embed"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-1" />
                  Copy
                </>
              )}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
