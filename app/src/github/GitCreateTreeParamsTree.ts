
export default interface GitCreateTreeParamsTree
{
    path?: string | undefined;
    mode?: "100644" | "100755" | "040000" | "160000" | "120000" | undefined;
    type?: "tree" | "blob" | "commit" | undefined;
    sha?: string | undefined;
    content?: string | undefined;
}