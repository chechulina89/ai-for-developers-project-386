import "@typespec/http";

using TypeSpec.Http;

@service(#{ title: "Project 386 API" })
namespace Project386;

@route("/health")
@get
op getHealth(): { status: "ok" };
