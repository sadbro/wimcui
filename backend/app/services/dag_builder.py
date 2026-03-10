import networkx as nx


def build_dag(graph):

    G = nx.DiGraph()

    for node in graph["nodes"]:
        G.add_node(node["id"], type=node["type"])

    for edge in graph["edges"]:
        G.add_edge(edge["source"], edge["target"])

    return {
        "nodes": list(G.nodes),
        "edges": list(G.edges)
    }