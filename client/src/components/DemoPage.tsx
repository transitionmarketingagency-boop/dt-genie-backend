import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ChatWidget from "./ChatWidget";
import EmbeddableWidget from "./EmbeddableWidget";
import { Sparkles, Code, Rocket, MessageCircle, Zap, Shield } from "lucide-react";

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12 max-w-6xl">
        <div className="text-center mb-12">
          <Badge className="mb-4" data-testid="badge-status">
            <Sparkles className="h-3 w-3 mr-1" />
            Free AI Chatbot System
          </Badge>
          <h1 className="text-4xl font-bold mb-4" data-testid="text-page-title">
            Digital Transition Marketing
          </h1>
          <h2 className="text-3xl font-bold text-primary mb-4">
            AI Chatbot Integration
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            A complete chatbot system powered by HuggingFace's free Llama 3.1 model.
            Ready to embed on any website with just a few lines of code.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <Card className="p-6 text-center">
            <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Zap className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold mb-2">100% Free</h3>
            <p className="text-sm text-muted-foreground">
              Powered by HuggingFace's free inference API. No hidden costs or subscriptions.
            </p>
          </Card>

          <Card className="p-6 text-center">
            <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Code className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold mb-2">Easy Integration</h3>
            <p className="text-sm text-muted-foreground">
              Copy-paste widget code works on Framer, WordPress, or any HTML site.
            </p>
          </Card>

          <Card className="p-6 text-center">
            <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold mb-2">Brand Customized</h3>
            <p className="text-sm text-muted-foreground">
              Pre-configured with your agency's voice, services, and booking flow.
            </p>
          </Card>
        </div>

        <Tabs defaultValue="demo" className="mb-12">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="demo" data-testid="tab-demo">
              <MessageCircle className="h-4 w-4 mr-2" />
              Live Demo
            </TabsTrigger>
            <TabsTrigger value="code" data-testid="tab-code">
              <Code className="h-4 w-4 mr-2" />
              Get Code
            </TabsTrigger>
          </TabsList>

          <TabsContent value="demo" className="space-y-6">
            <Card className="p-6">
              <h3 className="text-xl font-semibold mb-4" data-testid="text-demo-title">
                Interactive Chatbot Preview
              </h3>
              <p className="text-muted-foreground mb-6">
                Click the chat button in the bottom-right corner to test the chatbot interface.
                This demo shows how it will look and function on your website.
              </p>
              
              <div className="bg-muted/30 rounded-lg p-8 min-h-[400px] relative border-2 border-dashed border-border">
                <div className="text-center text-muted-foreground">
                  <MessageCircle className="h-16 w-16 mx-auto mb-4 opacity-20" />
                  <p className="text-lg font-medium mb-2">Your Website Content Goes Here</p>
                  <p className="text-sm">The chat widget appears in the bottom-right corner</p>
                  <Button className="mt-4" variant="outline" data-testid="button-demo-hint">
                    <Rocket className="h-4 w-4 mr-2" />
                    Look for the chat button →
                  </Button>
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-primary/5 border-primary/20">
              <h4 className="font-semibold mb-3">System Features:</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                  </div>
                  <span><strong>AI Model:</strong> Meta-Llama-3.1-8B-Instruct via HuggingFace (completely free)</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                  </div>
                  <span><strong>Session Management:</strong> Conversation history maintained per visitor</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                  </div>
                  <span><strong>Brand Voice:</strong> Trained on Digital Transition Marketing services and personality</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                  </div>
                  <span><strong>Lead Capture:</strong> Collects name/email and directs to Calendly booking</span>
                </li>
              </ul>
            </Card>
          </TabsContent>

          <TabsContent value="code">
            <EmbeddableWidget />
          </TabsContent>
        </Tabs>

        <Card className="p-6 bg-muted/50">
          <h3 className="text-lg font-semibold mb-4">What's Included:</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold text-sm mb-2">Backend (Node.js):</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Express server with CORS enabled</li>
                <li>• POST /chat endpoint</li>
                <li>• HuggingFace API integration</li>
                <li>• Session-based conversation history</li>
                <li>• Custom system prompt configuration</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-2">Frontend (Vanilla JS):</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Floating chat button widget</li>
                <li>• Expandable chat window</li>
                <li>• Real-time message display</li>
                <li>• Typing indicators</li>
                <li>• Mobile responsive design</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>

      <ChatWidget isDemo={true} />
    </div>
  );
}
