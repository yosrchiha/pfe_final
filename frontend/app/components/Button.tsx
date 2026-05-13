// app/components/Button.tsx
interface ButtonProps {
  type?: "button" | "submit" | "reset";
  children: React.ReactNode;
}

export default function Button({ type = "button", children }: ButtonProps) {
  return (
    <button
      type={type}
      className="w-full p-3 bg-blue-500 text-white font-bold rounded hover:bg-blue-600 transition"
    >
      {children}
    </button>
  );
}
