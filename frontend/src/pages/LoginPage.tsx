import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import AuthLayout from "../components/AuthLayout";
import InputField from "../components/InputField";
import { login } from "../api/auth.api";
import { setToken, setUser } from "../utils/token";

const loginSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (values: LoginFormValues) => {
    try {
      const result = await login(values);
      setToken(result.data.token);
      setUser(result.data.user);
      navigate("/dashboard");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Login failed";
      setError("root", { message });
    }
  };

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Use your node credentials to access the GridOS console."
    >
      <form className="auth-form" onSubmit={handleSubmit(onSubmit)}>
        <InputField
          label="Email"
          type="email"
          placeholder="you@node.grid"
          autoComplete="email"
          {...register("email")}
          error={errors.email?.message}
        />

        <InputField
          label="Password"
          type="password"
          placeholder="••••••••••"
          autoComplete="current-password"
          {...register("password")}
          error={errors.password?.message}
        />

        {errors.root?.message ? <p className="api-error">{errors.root.message}</p> : null}

        <button className="primary-btn" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="switch-link">
        New node? <Link to="/register">Create account</Link>
      </p>
    </AuthLayout>
  );
}
