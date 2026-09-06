import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Calculator, Delete, X } from "lucide-react";

type Operator = "+" | "-" | "x" | "/";

const keys = [
  ["C", "backspace", "%", "/"],
  ["7", "8", "9", "x"],
  ["4", "5", "6", "-"],
  ["1", "2", "3", "+"],
  ["0", ".", "="],
];

function calculate(left: number, right: number, operator: Operator) {
  if (operator === "+") return left + right;
  if (operator === "-") return left - right;
  if (operator === "x") return left * right;
  return right === 0 ? null : left / right;
}

export function CalculatorPopup({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [display, setDisplay] = useState("0");
  const [storedValue, setStoredValue] = useState<number | null>(null);
  const [operator, setOperator] = useState<Operator | null>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);
  const [equation, setEquation] = useState("");

  const reset = () => {
    setDisplay("0");
    setStoredValue(null);
    setOperator(null);
    setWaitingForOperand(false);
    setEquation("");
  };

  const inputDigit = (digit: string) => {
    if (waitingForOperand) {
      setDisplay(digit);
      setWaitingForOperand(false);
    } else {
      setDisplay(display === "0" ? digit : `${display}${digit}`);
    }
  };

  const inputDecimal = () => {
    if (waitingForOperand) {
      setDisplay("0.");
      setWaitingForOperand(false);
    } else if (!display.includes(".")) {
      setDisplay(`${display}.`);
    }
  };

  const chooseOperator = (nextOperator: Operator) => {
    const value = Number(display);
    if (storedValue !== null && operator && !waitingForOperand) {
      const result = calculate(storedValue, value, operator);
      if (result === null) {
        setDisplay("Error");
        setStoredValue(null);
        setOperator(null);
        setWaitingForOperand(true);
        return;
      }
      setStoredValue(result);
      setDisplay(String(result));
      setEquation(`${result} ${nextOperator}`);
    } else {
      setStoredValue(value);
      setEquation(`${display} ${nextOperator}`);
    }
    setOperator(nextOperator);
    setWaitingForOperand(true);
  };

  const equals = () => {
    if (storedValue === null || !operator) return;
    const result = calculate(storedValue, Number(display), operator);
    if (result === null) {
      setDisplay("Error");
    } else {
      setDisplay(String(result));
    }
    setEquation("");
    setStoredValue(null);
    setOperator(null);
    setWaitingForOperand(true);
  };

  const press = (key: string) => {
    if (key === "C") return reset();
    if (key === "backspace") {
      if (!waitingForOperand) setDisplay(display.length > 1 ? display.slice(0, -1) : "0");
      return;
    }
    if (key === "%") {
      setDisplay(String(Number(display) / 100));
      return;
    }
    if (key === ".") return inputDecimal();
    if (key === "=") return equals();
    if (["+", "-", "x", "/"].includes(key)) return chooseOperator(key as Operator);
    inputDigit(key);
  };

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      const keyMap: Record<string, string> = {
        "*": "x",
        Enter: "=",
        Escape: "C",
        Backspace: "backspace",
      };
      const key = keyMap[event.key] ?? event.key;
      if (/^[0-9.]$/.test(key) || ["+", "-", "x", "/", "%", "=", "C", "backspace"].includes(key)) {
        event.preventDefault();
        press(key);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: "spring", damping: 26, stiffness: 280 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="calculator-title"
            className="fixed bottom-6 left-1/2 z-50 w-[calc(100%-2rem)] max-w-[380px] -translate-x-1/2 rounded-3xl border border-border bg-card p-5 shadow-2xl"
          >
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calculator className="size-5 text-neon" />
                <h2 id="calculator-title" className="font-display text-lg font-bold">
                  Calculator
                </h2>
              </div>
              <button
                onClick={onClose}
                className="flex size-9 items-center justify-center rounded-full bg-secondary"
                aria-label="Close calculator"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mb-4 rounded-2xl bg-secondary/70 px-4 py-3 text-right">
              <div className="h-5 text-xs text-foreground/40">{equation}</div>
              <div className="truncate font-display text-4xl font-bold" aria-live="polite">
                {display}
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {keys.flat().map((key) => (
                <button
                  key={key}
                  onClick={() => press(key)}
                  className={`flex h-14 items-center justify-center rounded-2xl text-lg font-bold transition-colors active:scale-95 ${
                    key === "="
                      ? "col-span-2 bg-neon text-neon-foreground"
                      : ["/", "x", "-", "+"].includes(key)
                        ? "bg-accent text-accent-foreground"
                        : key === "C"
                          ? "bg-accent/20 text-accent"
                          : "bg-secondary hover:bg-secondary/80"
                  }`}
                  aria-label={key === "backspace" ? "Backspace" : key}
                >
                  {key === "backspace" ? <Delete className="size-5" /> : key}
                </button>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
