import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BurantoLogoSVG } from "@/components/buranto-logo";
import { Lock } from "lucide-react";

const VALID_PASSWORD = "buranto-2026";

interface LoginProps {
  onLogin: () => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (password === VALID_PASSWORD) {
        onLogin();
      } else {
        setError("Falsches Passwort");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm overflow-hidden">
        {/* Buranto yellow accent line at top */}
        <div style={{ height: '4px', background: '#FFE600' }} />
        <CardHeader className="text-center space-y-4 pt-6">
          <div className="flex justify-center">
            <BurantoLogoSVG width={200} />
          </div>
          <div>
            <h1 className="text-base font-black tracking-widest uppercase">BURANTO INTRANET</h1>
            <p className="text-xs text-muted-foreground mt-1">Sissach, Basel-Landschaft</p>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="password"
                placeholder="Passwort"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10"
                data-testid="input-password"
                autoFocus
              />
            </div>
            {error && (
              <p className="text-sm text-destructive text-center" data-testid="text-login-error">
                {error}
              </p>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={loading || !password}
              data-testid="button-login"
            >
              {loading ? "Anmelden..." : "Anmelden"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
