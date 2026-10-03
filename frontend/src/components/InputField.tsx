import { type InputHTMLAttributes } from "react";

type InputFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
};

export default function InputField({ label, error, ...props }: InputFieldProps) {
  return (
    <label className="input-field">
      <span className="input-label">{label}</span>
      <input className="input-control" {...props} />
      {error ? <small className="input-error">{error}</small> : null}
    </label>
  );
}
