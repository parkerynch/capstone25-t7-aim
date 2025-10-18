/**
 * `hello-api.ts`
 * - service endpoint for `/hello`
 *
 *
 * @author      Steve Jung <steve@lemoncloud.io>
 * @date        2025-10-10 initial version with `lemon-core#4.0.7`
 *
 * @copyright   (C) lemoncloud.io 2025 - All Rights Reserved. (https://eureka.codes)
 */
import { $T, $U, _log, NextHandler, GeneralWEBController, NextContext } from 'lemon-core';
import { Model, TestModel } from '../service/model';
import { HelloService } from '../service/service';
const NS = $U.NS('hello', 'yellow'); // NAMESPACE TO BE PRINTED.

/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * class: `HelloAPIController`
 * - handle of `/hello` type
 *
 * support basic CRUD operations.
 * - GET    /hello         => list-all
 * - GET    /hello/:id     => get-one
 * - POST   /hello/:id     => create-new (at position :id)
 * - PUT    /hello/:id     => update-existing (at position :id)
 * - DELETE /hello/:id     => delete-existing (at position :id)
 * - GET    /hello/:id/say => get-one with say command.
 */
export class HelloAPIController extends GeneralWEBController {
    /** sample data */
    private BUFF: TestModel[] = [
        {
            name: '1st',
        },
    ];

    /**
     * default constructor.
     */
    public constructor(readonly service?: HelloService) {
        super('hello');
        _log(NS, `HelloAPIController()...`);

        const tableName = $U.env('MY_DYNAMO_TABLE');
        this.service = service ?? new HelloService(tableName);
        _log(NS, `> tableName = ${tableName}`);
    }

    /**
     * name of this resource.
     */
    public hello = () => `hello-api-controller:${this.type()}`;

    /**
     * transform from model to view.
     */
    public modelAsView = <T extends Model>(model: T) => $U.cleanup({ ...model }) as T;

    /**
     * list hello
     *
     * ```sh
     * $ http ':8000/hello'
     */
    public doList: NextHandler = async (id, param, body, context) => {
        const errScope = `doList(${this.type()}/${id ?? ''})`;
        _log(NS, `${errScope} ...`);
        const name = $U.env('NAME'); // read via process.env
        const list = this.BUFF?.map((N, i) => this.modelAsView({ id: `${i}`, name: N.name }));
        return { name, list };
    };

    /**
     * get hello hello
     *
     * ```sh
     * $ http ':8000/hello/0'
     */
    public doGet: NextHandler = async (id, param, body, context) => {
        const errScope = `doGet(${this.type()}/${id ?? ''})`;
        _log(NS, `${errScope} ...`);
        const i = $U.N(id, 0);
        const val = this.BUFF[i];
        if (val === undefined) throw new Error(`404 NOT FOUND - id:${id}`);
        return this.modelAsView({ ...val, id: `${i}` });
    };

    /**
     * Only Update with incremental support
     *
     * ```sh
     * $ echo '{"name":1}' | http PUT ':8000/hello/0'
     * $ http PUT ':8000/hello/0' name=1
     */
    public doPut: NextHandler = async (id, param, body, context) => {
        const errScope = `doPut(${this.type()}/${id ?? ''})`;
        _log(NS, `${errScope} ...`);
        const node = await this.doGet(id, null, null, context);
        const i = $U.N(node?.id, 0);
        this.BUFF[i] = { ...node, ...body };
        return this.modelAsView(this.BUFF[i]);
    };

    /**
     * Insert new Node at position 0.
     *
     * ```sh
     * $ http :8000/hello/0 name=hello
     */
    public doPost: NextHandler = async (id, param, body, context) => {
        const errScope = `doPost(${this.type()}/${id ?? ''})`;
        _log(NS, `${errScope} ...`);
        if (id == 'echo') return this.doPostEcho('0', param, body, context);
        if (id == 'analyze') return this.doPostAnalyze('0', param, body, context);

        //* append into array.
        _log(NS, errScope);
        const i = $U.N(id, 0);
        if (i) throw new Error(`@id[${id}] (number) is invalid - ${errScope}`);
        if (!body?.name) throw new Error(`.name (string) is required - ${errScope}`);
        const name = $T.S2(body?.name, '', ' ').trim(); // clear new-lines
        const model: TestModel = { name, _id: `${this.BUFF.length}` };
        this.BUFF.push(model);

        // returns the last-index.
        return this.modelAsView({ ...model, id: `${this.BUFF.length - 1}` });
    };

    /**
     * echo the request.
     *
     * ```sh
     * $ http :8000/hello/0/echo name=hello
     */
    public doPostEcho: NextHandler = async (id, param, body, $ctx) => {
        const errScope = `doPostEcho(${this.type()}/${id ?? ''})`;
        _log(NS, `${errScope} ...`);
        const context = $T.onlyDefined<NextContext>({
            domain: $ctx?.domain,
            clientIp: $ctx?.clientIp,
            userAgent: $ctx?.userAgent,
            authorization: $ctx?.authorization,
            referer: $ctx?.referer,
            cookie: $ctx?.cookie,
        });
        return { id, cmd: 'echo', param, body, context };
    };

    /**
     * Delete Node (or mark deleted)
     *
     * ```sh
     * $ http DELETE ':8000/hello/1'
     */
    public doDelete: NextHandler = async (id, param, body, context) => {
        const errScope = `doDelete(${this.type()}/${id ?? ''})`;
        _log(NS, `${errScope} ...`);

        // find, and delete by index
        const node = await this.doGet(id, null, null, context);
        const i = $U.N(node?.id, 0);
        delete this.BUFF[i];
        return this.modelAsView(node);
    };

    /**
     * Analyze the project.
     *
     * ```sh
     * $ http POST ':8000/hello/analyze' s3Url=...
     */
    public doPostAnalyze: NextHandler = async (id, param, body, context) => {
        const errScope = `doPostAnalyze(${this.type()}/${id ?? ''})`;
        _log(NS, `${errScope} ...`);

        const s3Url = body?.s3Url;
        if (!s3Url) {
            throw new Error('s3Url is required');
        }

        _log(NS, `[DEBUG] Received S3 URL: ${s3Url}`);

        // 1. Download the file from S3
        const protocol = s3Url.startsWith('https://') ? require('https') : require('http');
        const fs = require('fs');
        const os = require('os');
        const path = require('path');

        _log(NS, `[DEBUG] Selected protocol: ${protocol.globalAgent.protocol}`);

        const downloadedFilePath = path.join(os.tmpdir(), `project.zip`);
        const file = fs.createWriteStream(downloadedFilePath);

        await new Promise((resolve, reject) => {
            // ⭐️ 수정된 부분: 선택된 프로토콜(http 또는 https)을 사용합니다.
            protocol
                .get(s3Url, (response: any) => {
                    // S3 리다이렉션 처리 (Presigned URL은 가끔 리다이렉션을 포함할 수 있음)
                    if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                        const redirectProtocol = response.headers.location.startsWith('https://')
                            ? require('https')
                            : require('http');
                        redirectProtocol
                            .get(response.headers.location, (redirectResponse: any) => {
                                redirectResponse.pipe(file);
                                file.on('finish', () => {
                                    file.close();
                                    resolve(null);
                                });
                            })
                            .on('error', (err: any) => {
                                fs.unlink(downloadedFilePath, () => {});
                                reject(err);
                            });
                        return;
                    }

                    response.pipe(file);
                    file.on('finish', () => {
                        file.close();
                        resolve(null);
                    });
                })
                .on('error', (err: any) => {
                    fs.unlink(downloadedFilePath, () => {});
                    reject(err);
                });
        });

        // 2. Construct the prompt
        const prompt = `
            Analyze the provided zip file and identify the frontend and backend services.
            The project structure is a monorepo with 'apps/frontend' and 'apps/backend' directories.
            The frontend is a React application and the backend is a Node.js application.
            Provide the framework and language for each service.
            The output should be a JSON object with the following structure:
            {
                "frontend": {
                    "framework": "React",
                    "language": "TypeScript"
                },
                "backend": {
                    "framework": "Express.js",
                    "language": "TypeScript"
                }
            }
        `;

        // // 3. Call the Gemini service  <-- 주석 처리
        // const { GeminiService } = require('../service/service');
        // const geminiService = new GeminiService();
        // const genAI = geminiService.getClient();
        // const model = genAI.getGenerativeModel({ model: "gemini-pro" });

        // const result = await model.generateContent(prompt);
        // const response = await result.response;
        // const text = await response.text();

        // // 4. Return the analysis JSON <-- 주석 처리
        // return JSON.parse(text);

        // ⭐️ 4. Return a mock analysis JSON (가짜 응답 반환)
        _log(NS, `[DEBUG] Bypassing Gemini API call and returning mock data.`);
        const mockAnalysis = {
            frontend: {
                framework: 'React',
                language: 'TypeScript',
            },
            backend: {
                framework: 'Express.js',
                language: 'TypeScript',
            },
        };
        return mockAnalysis;
    };
}

//*export as default.
export default new HelloAPIController();
