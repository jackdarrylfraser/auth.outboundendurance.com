import { connection } from "next/server";
import type { ReactNode } from "react";

type ServerComponent<Props> = (
  props: Props,
) => ReactNode | Promise<ReactNode>;

export function withConnection<Props>(
  component: ServerComponent<Props>,
): (props: Props) => Promise<ReactNode> {
  return async function ConnectedComponent(props: Props) {
    await connection();
    return component(props);
  };
}
