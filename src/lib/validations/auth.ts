import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email("Ongeldig e-mailadres"),
  displayName: z
    .string()
    .min(3, "Minimaal 3 tekens")
    .max(30, "Maximaal 30 tekens")
    .regex(/^[a-zA-Z0-9_-]+$/, "Alleen letters, cijfers, - en _"),
  password: z.string().min(8, "Minimaal 8 tekens"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Wachtwoorden komen niet overeen",
  path: ["confirmPassword"],
});

export const loginSchema = z.object({
  email: z.string().email("Ongeldig e-mailadres"),
  password: z.string().min(1, "Wachtwoord is verplicht"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
