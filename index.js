/**
 * Created by exolution on 17/1/6.
 */
const reParse = /^.*?[/\\]?(?=([^\/\\]*$))/;
const pathTool = require('path');
const fs = require('fs-extra');
const _baseMapper={}
//const reParse=/^[^,]*[/\\](?=([^\/\\]*$|([\w_.!@*^\/\\-]+,)*[\w_.!@*^\/\\-]+$))/;
const generateEliminated = (path, file) => {
    return new RegExp('^' + pathTool.join(path.replace(/^\^/, ''), file.replace(/^\^/, '')).replace(/[\\\[\].^$\}\{]/g, '\\$&').replace(/\*\*/g, '.+').replace(/\*/g, '[^/]*'))
}
const parse = (source, recursive) => {
    let m = reParse.exec(source);
    let path, files;
    if (m) {
        path = m[0];
        files = m[1];
        if(path){
            _baseMapper[source]=path
        }
        let wildcard = {ext: [], recursive: false, enable: false, path: path};
        let fileList = [], eliminated = [];
        if (!files) files = recursive ? '**' : '*';
        files.split(',').forEach((file)=> {
            if (file[0] === '^' || source[0] === '^') {
                eliminated.push(generateEliminated(path, file));
            }
            else if (file === '**') {
                wildcard.enable = true;
                wildcard.recursive = true;
                wildcard.ext.unshift({value: '*', recursive: true})
            }
            else if (file === '*') {
                wildcard.enable = true;
                wildcard.ext.push({value: '*', recursive: false})
            }
            else if ((m = /\*(\*?)(\..*)/.exec(file)) && !wildcard.recursive) {
                wildcard.enable = true;
                wildcard.recursive = !!m[1];
                wildcard.ext.push({value: m[2], recursive: !!m[1]});
            }
            else {
                fileList.push(pathTool.join(path, file));
            }

        })
        return {
            wildcard: wildcard.enable ? wildcard : false,
            fileList,
            eliminated
        }
    }
    else {
        throw new Error('Unrecognized source:', source);
    }

}
const merge = (sources, recursive) => {
    let fileList = {}, eliminated = {}, wildcard = {};
    for (let source of sources) {
        let parsed = parse(source, recursive);
        parsed.fileList.forEach((e) => {
            fileList[e] = true;
        });
        parsed.eliminated.forEach((e) => {
            eliminated[e] = true;
        });
        if (parsed.wildcard) {
            let prev = wildcard[parsed.wildcard.path];
            if (prev) {
                if (prev.recursive == false && parsed.wildcard.recursive == true)prev.recursive = true;
                prev.ext.push.apply(prev.ext, parsed.wildcard.ext);
            }
            else {
                wildcard[parsed.wildcard.path] = parsed.wildcard;
            }
        }

    }
    let wildcardList = [];
    for (let key in wildcard) {
        wildcardList.push(wildcard[key]);
    }
    return {
        fileList: Object.keys(fileList),
        eliminated: Object.keys(eliminated).map(e=>new RegExp(e.slice(1, -1))),
        wildcard: wildcardList.length > 0 ? wildcardList.length == 1 ? wildcardList[0] : wildcardList : false
    };
}
const isEliminated = (eliminatedList, path) => {
    for (let eliminated of eliminatedList) {
        if (eliminated.test(path)) {
            return true;
        }
    }
    return false;
}
const findSource = (path, source, options = {}) => {
    let parsed, fileList = [];

    if (Array.isArray(source)) {
        parsed = merge(source, options.recursive);
    }
    else {
        parsed = parse(source, options.recursive);
    }
    if (options.eliminated) {
        parsed.eliminated = parsed.eliminated.concat(options.eliminated);
    }
    if (!options.dotfiles) {
        parsed.eliminated.push(/(^|\/|\\)\.[^/\\]+$/);
    }
    parsed.fileList.forEach((file)=> {
        let p = pathTool.resolve(path, file);
        if (fs.existsSync(p) && !isEliminated(parsed.eliminated, file)) {
            let stat = fs.statSync(p);
            if (stat.isDirectory()) {
                let wildcard = {
                    path: file,
                    recursive: options.recursive,
                    ext: [{value: '*', recursive: options.recursive}]
                };
                _baseMapper[source]=file
                if (parsed.wildcard) {
                    if (Array.isArray(parsed.wildcard)) {
                        parsed.wildcard.push(wildcard)
                    }
                    else {
                        parsed.wildcard = [parsed.wildcard, wildcard]
                    }
                }
                else {
                    parsed.wildcard = wildcard;
                }
            }
            else {
                fileList.push(p)
            }

        }
    });
    if (parsed.wildcard) {
        if (Array.isArray(parsed.wildcard)) {
            for (let wildcard of parsed.wildcard) {
                fileList = fileList.concat(scanDir(path, wildcard.path, wildcard, parsed.eliminated, true))
            }
        }
        else {
            fileList = fileList.concat(scanDir(path, parsed.wildcard.path, parsed.wildcard, parsed.eliminated, true))
        }

    }
    return fileList;
}
const resolveExt = (file, wildcard, notrecursive) => {
    for (let ext of wildcard.ext) {
        if ((ext.value === '*' || pathTool.extname(file) === ext.value) && (ext.recursive || notrecursive)) {
            return true;
        }
    }
    return false;
}
const scanDir = (root, path, wildcard, eliminated, notrecursive) => {
    let fileList = [];
    let currentDirPath = pathTool.resolve(root, path);
    let files = fs.readdirSync(currentDirPath)
    files.forEach((file)=> {
        let fullPath = pathTool.join(currentDirPath, file);
        if (!isEliminated(eliminated, pathTool.join(path, file))) {
            let stat = fs.statSync(fullPath);
            if (stat.isDirectory() && wildcard.recursive) {
                fileList = fileList.concat(scanDir(root, pathTool.join(path, file), wildcard, eliminated, false))
            }
            else {
                if (resolveExt(file, wildcard, notrecursive)) {
                    fileList.push(fullPath);
                }
            }
        }
    });
    return fileList;
}

const find = findSource;

const base= (source) => {
    return _baseMapper[source]||''
}

module.exports = {
  find,
  base
}