import { auth } from "@/auth";

export type Viewer = {
  userId: string | null;
  userName: string;
  isGuest: boolean;
};

export async function getViewer(): Promise<Viewer> {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const name = session?.user?.name?.trim();

  return {
    userId,
    userName: name && name.length > 0 ? name : "Guest",
    isGuest: !userId,
  };
}

