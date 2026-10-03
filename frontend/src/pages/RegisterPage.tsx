import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import AuthLayout from "../components/AuthLayout";
import InputField from "../components/InputField";
import { register as registerApi } from "../api/auth.api";
import { setToken, setUser } from "../utils/token";

const registerSchema = z
  .object({
    name: z.string().min(2, "Node name must be at least 2 characters"),
    email: z.email("Enter a valid email address"),
    mobile: z
      .string()
      .min(10, "Mobile number must be at least 10 digits")
      .max(20, "Mobile number must be at most 20 characters")
      .regex(/^[0-9+\-() ]+$/, "Only numbers and + - ( ) are allowed"),
    walletAddress: z
      .string()
      .max(128, "Wallet address is too long")
      .regex(/^(0x[a-fA-F0-9]{40})?$/, "Use a valid EVM address or leave blank"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string().min(6, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { walletAddress: "" },
  });

  const onSubmit = async (values: RegisterFormValues) => {
    try {
      const result = await registerApi({
        name: values.name,
        email: values.email,
        mobile: values.mobile,
        password: values.password,
      });
      setToken(result.data.token);
      setUser(result.data.user);
      navigate("/dashboard");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Registration failed";
      setError("root", { message });
    }
  };

  return (
    <AuthLayout
      title="Create account"
      subtitle="Register your node on GridOS. Wallet is optional until settlement is enabled."
    >
      <form className="auth-form" onSubmit={handleSubmit(onSubmit)}>
        <InputField
          label="Node name"
          type="text"
          placeholder="ALPHA-07"
          autoComplete="organization"
          {...register("name")}
          error={errors.name?.message}
        />

        <InputField
          label="Email"
          type="email"
          placeholder="operator@grid.system"
          autoComplete="email"
          {...register("email")}
          error={errors.email?.message}
        />

        <InputField
          label="Mobile"
          type="text"
          placeholder="+1 555 000 0000"
          autoComplete="tel"
          {...register("mobile")}
          error={errors.mobile?.message}
        />

        <InputField
          label="Wallet address (optional)"
          type="text"
          placeholder="0x…"
          autoComplete="off"
          {...register("walletAddress")}
          error={errors.walletAddress?.message}
        />

        <InputField
          label="Password"
          type="password"
          placeholder="••••••••••"
          autoComplete="new-password"
          {...register("password")}
          error={errors.password?.message}
        />

        <InputField
          label="Confirm password"
          type="password"
          placeholder="••••••••••"
          autoComplete="new-password"
          {...register("confirmPassword")}
          error={errors.confirmPassword?.message}
        />

        {errors.root?.message ? <p className="api-error">{errors.root.message}</p> : null}

        <button className="primary-btn" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="switch-link">
        Already registered? <Link to="/login">Sign in</Link>
      </p>
    </AuthLayout>
  );
}
