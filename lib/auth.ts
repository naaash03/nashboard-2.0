import { auth } from "@/auth";

export type Viewer = {
  userId: string | null;
  userName: string;
  email: string | null;
  isGuest: boolean;
};

export async function getViewer(): Promise<Viewer> {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const name = session?.user?.name?.trim();
  const email = session?.user?.email?.trim().toLowerCase();

  return {
    userId,
    userName: name && name.length > 0 ? name : "Guest",
    email: email && email.length > 0 ? email : null,
    isGuest: !userId,
  };
}

