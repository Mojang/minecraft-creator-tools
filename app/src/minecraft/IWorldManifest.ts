

export default interface IWorldManifest 
{
    format_version : number;
    __comment__? : string;
    header: IWorldManifestHeader,
    modules: IWorldModule[]
}

export interface IWorldManifestHeader
{
    base_game_version: number[];
    description: string;
    lock_template_options: boolean;
    name: string;
    platform_locked: boolean;
    uuid: string;
    version: number[];
}

export interface IWorldModule
{
    description: string;
    type: string;
    uuid: string;
    version: number[];
}
