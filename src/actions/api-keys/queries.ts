import { queryOptions } from "@tanstack/react-query";
import { getApiKeys } from ".";

export const getApiKeysQuery = () =>
  queryOptions({
    queryKey: ["api-keys", "getApiKeys"],
    queryFn: ({ signal }) => getApiKeys({ signal }),
  });
