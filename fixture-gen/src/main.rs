//! Golden-fixture generator for the TypeScript port of sapling-renderdag.
//!
//! Replays named test fixtures (copied from the crate's test_fixtures.rs /
//! test_utils.rs) and randomly generated DAGs through the *real* Rust crate,
//! recording every input and output as JSON. The TypeScript test suite then
//! replays the same inputs and asserts byte-identical outputs.

use std::collections::BTreeMap;
use std::collections::BTreeSet;
use std::collections::HashMap;
use std::collections::HashSet;

use renderdag::Ancestor;
use renderdag::GraphRow;
use renderdag::GraphRowRenderer;
use renderdag::NodeLine;
use renderdag::OutputRendererOptions;
use renderdag::PadLine;
use renderdag::Renderer;
use serde_json::json;
use serde_json::Value;

// ---------------------------------------------------------------------------
// Step model
// ---------------------------------------------------------------------------

#[derive(Clone, Debug)]
enum PKind {
    Parent,
    Ancestor,
    Anonymous,
}

#[derive(Clone, Debug)]
struct RowStep {
    node: String,
    parents: Vec<(PKind, Option<String>)>,
    glyph: String,
    message: String,
}

#[derive(Clone, Debug)]
enum Step {
    Reserve(String),
    Row(RowStep),
}

fn mk_parents(step: &RowStep) -> Vec<Ancestor<String>> {
    step.parents
        .iter()
        .map(|(kind, node)| match kind {
            PKind::Parent => Ancestor::Parent(node.clone().unwrap()),
            PKind::Ancestor => Ancestor::Ancestor(node.clone().unwrap()),
            PKind::Anonymous => Ancestor::Anonymous,
        })
        .collect()
}

// ---------------------------------------------------------------------------
// JSON serialization of structured output
// ---------------------------------------------------------------------------

fn node_line_str(n: &NodeLine) -> &'static str {
    match n {
        NodeLine::Blank => "blank",
        NodeLine::Ancestor => "ancestor",
        NodeLine::Parent => "parent",
        NodeLine::Node => "node",
    }
}

fn pad_line_str(p: &PadLine) -> &'static str {
    match p {
        PadLine::Blank => "blank",
        PadLine::Ancestor => "ancestor",
        PadLine::Parent => "parent",
    }
}

fn row_to_json(row: &GraphRow<String>) -> Value {
    json!({
        "merge": row.merge,
        "separatorLine": row.separator_line,
        "nodeLine": row.node_line.iter().map(node_line_str).collect::<Vec<_>>(),
        "linkLine": row.link_line.as_ref().map(|l| l.iter().map(|x| x.bits()).collect::<Vec<u16>>()),
        "termLine": row.term_line,
        "padLines": row.pad_lines.iter().map(pad_line_str).collect::<Vec<_>>(),
    })
}

fn step_input_json(step: &Step) -> Value {
    match step {
        Step::Reserve(node) => json!({"type": "reserve", "node": node}),
        Step::Row(row) => json!({
            "type": "row",
            "node": row.node,
            "parents": row.parents.iter().map(|(kind, node)| {
                match kind {
                    PKind::Parent => json!(["parent", node.clone().unwrap()]),
                    PKind::Ancestor => json!(["ancestor", node.clone().unwrap()]),
                    PKind::Anonymous => json!(["anonymous"]),
                }
            }).collect::<Vec<_>>(),
            "glyph": row.glyph,
            "message": row.message,
        }),
    }
}

// ---------------------------------------------------------------------------
// Case runner
// ---------------------------------------------------------------------------

const TEXT_STYLES: [&str; 5] = ["ascii", "asciiLarge", "boxCurved", "boxSquare", "boxDec"];

fn build_text_renderer(
    style: &str,
    options: OutputRendererOptions,
) -> Box<dyn Renderer<String, Output = String>> {
    let builder = GraphRowRenderer::<String>::new().output().with_options(options);
    match style {
        "ascii" => Box::new(builder.build_ascii()),
        "asciiLarge" => Box::new(builder.build_ascii_large()),
        "boxCurved" => Box::new(builder.build_box_drawing()),
        "boxSquare" => Box::new(builder.build_box_drawing().with_square_glyphs()),
        "boxDec" => Box::new(builder.build_box_drawing().with_dec_graphics_glyphs()),
        _ => unreachable!(),
    }
}

fn run_case(name: &str, options: OutputRendererOptions, steps: &[Step]) -> Value {
    let mut graph = GraphRowRenderer::<String>::new();
    *graph.output_options_mut() = options;

    let mut texts: Vec<Box<dyn Renderer<String, Output = String>>> = TEXT_STYLES
        .iter()
        .map(|style| build_text_renderer(style, options))
        .collect();

    let mut steps_json: Vec<Value> = Vec::new();
    for step in steps {
        let mut obj = step_input_json(step);
        match step {
            Step::Reserve(node) => {
                graph.reserve(node.clone());
                for t in texts.iter_mut() {
                    t.reserve(node.clone());
                }
            }
            Step::Row(row) => {
                let parents = mk_parents(row);
                let widths = json!({
                    "none": graph.width(None, None),
                    "node": graph.width(Some(&row.node), None),
                    "full": graph.width(Some(&row.node), Some(&parents)),
                });
                let graph_row = graph.next_row(
                    row.node.clone(),
                    parents,
                    row.glyph.clone(),
                    row.message.clone(),
                );

                let mut text_json = serde_json::Map::new();
                for (style, t) in TEXT_STYLES.iter().zip(texts.iter_mut()) {
                    let parents = mk_parents(row);
                    let width = t.width(Some(&row.node), Some(&parents));
                    let out =
                        t.next_row(row.node.clone(), parents, row.glyph.clone(), row.message.clone());
                    text_json.insert(
                        style.to_string(),
                        json!({"width": width, "out": out}),
                    );
                }

                let expect = json!({
                    "widths": widths,
                    "graphRow": row_to_json(&graph_row),
                    "text": Value::Object(text_json),
                });
                obj.as_object_mut().unwrap().insert("expect".to_string(), expect);
            }
        }
        steps_json.push(obj);
    }

    json!({
        "name": name,
        "options": {
            "minRowHeight": options.min_row_height,
            "stagger": options.stagger_consecutive_disconnected_nodes,
        },
        "steps": steps_json,
    })
}

// ---------------------------------------------------------------------------
// Named fixtures (copied from renderdag/src/test_fixtures.rs)
// ---------------------------------------------------------------------------

#[derive(Clone, Default)]
struct TestFixture {
    dag: &'static str,
    messages: &'static [(&'static str, &'static str)],
    heads: &'static [&'static str],
    reserve: &'static [&'static str],
    ancestors: &'static [(&'static str, &'static str)],
    missing: &'static [&'static str],
}

const BASIC: TestFixture = TestFixture {
    dag: "A-B-C",
    messages: &[],
    heads: &["C"],
    reserve: &[],
    ancestors: &[],
    missing: &[],
};

const BASIC_DISCONNECTED: TestFixture = TestFixture {
    dag: "A B C-D",
    messages: &[],
    heads: &["A", "B", "D"],
    reserve: &[],
    ancestors: &[],
    missing: &[],
};

const BRANCHES_AND_MERGES: TestFixture = TestFixture {
    dag: r#"
                      T /---------------N--O---\           T
                     / /                        \           \
               /----E-F-\    /-------L--M--------P--\     S--U---\
            A-B-C-D------G--H--I--J--K---------------Q--R---------V--W
                                   \--N
    "#,
    messages: &[],
    heads: &["W"],
    reserve: &[],
    ancestors: &[],
    missing: &[],
};

const OCTOPUS_BRANCH_AND_MERGE: TestFixture = TestFixture {
    dag: r#"
                        /-----\
                       /       \
                      D /--C--\ I
                     / /---D---\ \
                    A-B----E----H-J
                       \---F---/ /
                        \--G--/ F
    "#,
    messages: &[],
    heads: &["J"],
    reserve: &[],
    ancestors: &[],
    missing: &[],
};

const RESERVED_COLUMN: TestFixture = TestFixture {
    dag: r#"
                   A-B-C-F-G----\
                    D-E-/   \-W  \-X-Y-Z
    "#,
    messages: &[],
    heads: &["W", "Z"],
    reserve: &["G"],
    ancestors: &[],
    missing: &[],
};

const ANCESTORS: TestFixture = TestFixture {
    dag: r#"
                   A----B-D-----E----------F-\
                    \-C--/       \-W  \-X     \-Y-Z
    "#,
    messages: &[],
    heads: &["W", "X", "Z"],
    reserve: &["F"],
    ancestors: &[("C", "A"), ("D", "C"), ("E", "D"), ("F", "E")],
    missing: &[],
};

const SPLIT_PARENTS: TestFixture = TestFixture {
    dag: r#"
                    /-B-\     A-\
                   A     D-E  B--E
                    \-C-/     C-/
    "#,
    messages: &[],
    heads: &["E"],
    reserve: &["B", "D", "C"],
    ancestors: &[("E", "A"), ("E", "B")],
    missing: &[],
};

const TERMINATIONS: TestFixture = TestFixture {
    dag: r#"
                   A-B-C  D-E-\
                            F---I--J
                        X-D-H-/  \-K
    "#,
    messages: &[],
    heads: &["C", "J", "K"],
    reserve: &["E"],
    ancestors: &[("B", "A")],
    missing: &["A", "F", "X"],
};

const LONG_MESSAGE: &str = "long message 1\nlong message 2\nlong message 3\n\n";
const VERY_LONG_MESSAGE: &str = "very long message 1\nvery long message 2\nvery long message 3\n\n\
     very long message 4\nvery long message 5\nvery long message 6\n\n";

const LONG_MESSAGES: TestFixture = TestFixture {
    dag: r#"
                         Y-\
                  Z-A-B-D-E-F
                       \-C-/
    "#,
    messages: &[
        ("A", LONG_MESSAGE),
        ("C", LONG_MESSAGE),
        ("F", VERY_LONG_MESSAGE),
    ],
    heads: &["F"],
    reserve: &[],
    ancestors: &[],
    missing: &["Y", "Z"],
};

const ORDERS1: TestFixture = TestFixture {
    dag: r#"
                    K
                   /|
                  F J
                 / /|
                | E I
                |/ /|
                | D H
                |/ /|
                | C G
                |/ /|
                | B Z
                |/
                A
    "#,
    messages: &[],
    heads: &["K"],
    reserve: &[],
    ancestors: &[],
    missing: &[],
};

const ORDERS2: TestFixture = TestFixture {
    dag: r#"
                    K
                   /|
                  J F
                 / /|
                | I E
                |/ /|
                | H D
                |/ /|
                | G C
                |/ /|
                | B Z
                |/
                A
    "#,
    messages: &[],
    heads: &["K"],
    reserve: &[],
    ancestors: &[],
    missing: &[],
};

// ---------------------------------------------------------------------------
// MiniDag (copied from renderdag/src/test_utils.rs)
// ---------------------------------------------------------------------------

#[derive(Default)]
struct MiniDag {
    parents: BTreeMap<String, BTreeSet<String>>,
    name_to_rev: BTreeMap<String, usize>,
    rev_to_name: Vec<String>,
}

impl MiniDag {
    fn from_drawdag(ascii: &str) -> Self {
        Self {
            parents: drawdag::parse(ascii),
            ..Default::default()
        }
    }

    fn assign_rev(&mut self, name: &str) -> usize {
        if let Some(&rev) = self.name_to_rev.get(name) {
            rev
        } else {
            if let Some(parents) = self.parents.get(name).cloned() {
                for p in parents {
                    self.assign_rev(p.as_str());
                }
            }
            let rev = self.rev_to_name.len();
            self.rev_to_name.push(name.to_owned());
            self.name_to_rev.insert(name.to_owned(), rev);
            rev
        }
    }

    /// All names, in DESC order.
    fn all(&self) -> Vec<String> {
        let mut all = self.rev_to_name.clone();
        all.reverse();
        all
    }

    fn parent_names(&self, name: &str) -> Vec<String> {
        match self.parents.get(name) {
            Some(names) => names.iter().cloned().collect(),
            None => Default::default(),
        }
    }
}

/// Convert a fixture (+ optional explicit order) into a list of steps,
/// mirroring test_utils::render_string_with_order.
fn fixture_steps(fixture: &TestFixture, order: Option<&[&str]>) -> Vec<Step> {
    let mut dag = MiniDag::from_drawdag(fixture.dag);
    for head in fixture.heads.iter() {
        dag.assign_rev(head);
    }

    let ancestors: HashSet<(&str, &str)> = fixture.ancestors.iter().copied().collect();
    let missing: HashSet<&str> = fixture.missing.iter().copied().collect();
    let messages: HashMap<_, _> = fixture.messages.iter().cloned().collect();

    let mut steps: Vec<Step> = fixture
        .reserve
        .iter()
        .map(|s| Step::Reserve(s.to_string()))
        .collect();

    let iter: Vec<String> = match order {
        None => dag.all(),
        Some(order) => order.iter().map(|name| name.to_string()).collect(),
    };

    for node in iter {
        if missing.contains(node.as_str()) {
            continue;
        }
        let parents = dag
            .parent_names(&node)
            .into_iter()
            .map(|parent| {
                if missing.contains(parent.as_str()) {
                    (PKind::Anonymous, None)
                } else if ancestors.contains(&(node.as_str(), parent.as_str())) {
                    (PKind::Ancestor, Some(parent))
                } else {
                    (PKind::Parent, Some(parent))
                }
            })
            .collect();
        let message = match messages.get(node.as_str()) {
            Some(message) => format!("{node}\n{message}"),
            None => node.clone(),
        };
        steps.push(Step::Row(RowStep {
            node,
            parents,
            glyph: "o".to_string(),
            message,
        }));
    }
    steps
}

// ---------------------------------------------------------------------------
// Random cases
// ---------------------------------------------------------------------------

struct Rng(u64);

// Hand-rolled xorshift64 rather than the `rand` crate: these are golden
// fixtures, so the corpus must be byte-reproducible forever. A fixed local PRNG
// pins the exact 200 DAGs across machines and toolchains, with no dependency on
// `rand`'s version-specific algorithms or seeding. Statistical quality is
// irrelevant here — we only need a deterministic spread over the input space.
impl Rng {
    fn new(seed: u64) -> Self {
        Rng(seed.wrapping_mul(0x9E3779B97F4A7C15) | 1)
    }
    fn next(&mut self) -> u64 {
        let mut x = self.0;
        x ^= x << 13;
        x ^= x >> 7;
        x ^= x << 17;
        self.0 = x;
        x.wrapping_mul(0x2545F4914F6CDD1D)
    }
    fn below(&mut self, n: u64) -> u64 {
        self.next() % n
    }
    fn chance(&mut self, pct: u64) -> bool {
        self.below(100) < pct
    }
}

fn random_case(idx: u64) -> (OutputRendererOptions, Vec<Step>) {
    let mut rng = Rng::new(idx + 1);

    let options = OutputRendererOptions {
        min_row_height: rng.below(4) as usize,
        stagger_consecutive_disconnected_nodes: rng.chance(30),
    };

    let n = 1 + rng.below(24) as usize;
    let names: Vec<String> = (0..n).map(|i| format!("N{i}")).collect();

    // Random parent structure: parents of node i come from indices > i.
    let mut parents_of: Vec<Vec<(PKind, Option<String>)>> = Vec::new();
    for i in 0..n {
        let pool: Vec<usize> = (i + 1..n).collect();
        let count_roll = rng.below(100);
        let mut count = if count_roll < 25 {
            0
        } else if count_roll < 70 {
            1
        } else if count_roll < 90 {
            2
        } else if count_roll < 97 {
            3
        } else {
            4
        };
        count = count.min(pool.len());
        let mut chosen: Vec<usize> = Vec::new();
        let mut parents: Vec<(PKind, Option<String>)> = Vec::new();
        for _ in 0..count {
            if rng.chance(8) {
                parents.push((PKind::Anonymous, None));
                continue;
            }
            let j = pool[rng.below(pool.len() as u64) as usize];
            // 5% chance to keep a duplicate parent, otherwise skip repeats.
            if chosen.contains(&j) && !rng.chance(5) {
                continue;
            }
            chosen.push(j);
            let kind = if rng.chance(15) {
                PKind::Ancestor
            } else {
                PKind::Parent
            };
            parents.push((kind, Some(names[j].clone())));
        }
        parents_of.push(parents);
    }

    // Emission order: usually topological (0..n), sometimes shuffled.
    let mut order: Vec<usize> = (0..n).collect();
    if rng.chance(15) {
        for i in (1..n).rev() {
            let j = rng.below((i + 1) as u64) as usize;
            order.swap(i, j);
        }
    }

    let mut steps: Vec<Step> = Vec::new();

    if rng.chance(20) {
        let reserves = 1 + rng.below(3);
        for _ in 0..reserves {
            let j = rng.below(n as u64) as usize;
            steps.push(Step::Reserve(names[j].clone()));
        }
    }

    for (pos, &i) in order.iter().enumerate() {
        // Occasional mid-stream reserve of a node not yet rendered.
        if rng.chance(5) && pos + 1 < n {
            let j = order[pos + 1 + rng.below((n - pos - 1) as u64) as usize];
            steps.push(Step::Reserve(names[j].clone()));
        }

        let glyph = match rng.below(100) {
            0..=79 => "o",
            80..=89 => "@",
            90..=94 => "x",
            _ => "\u{00AE}",
        }
        .to_string();

        let name = &names[i];
        let message = match rng.below(100) {
            0..=49 => name.clone(),
            50..=69 => String::new(),
            70..=84 => format!("{name}\nline2"),
            85..=94 => format!("{name}\nline2\nline3\n"),
            _ => format!("{name}\n\nline3\n\n"),
        };

        steps.push(Step::Row(RowStep {
            node: name.clone(),
            parents: parents_of[i].clone(),
            glyph,
            message,
        }));
    }

    (options, steps)
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

fn opts(min_row_height: usize, stagger: bool) -> OutputRendererOptions {
    OutputRendererOptions {
        min_row_height,
        stagger_consecutive_disconnected_nodes: stagger,
    }
}

fn main() {
    let out_dir = std::env::args().nth(1).unwrap_or_else(|| "tests/fixtures".to_string());
    std::fs::create_dir_all(&out_dir).unwrap();

    // Named fixtures under an option matrix.
    let named: Vec<(&str, TestFixture)> = vec![
        ("basic", BASIC),
        ("basic_disconnected", BASIC_DISCONNECTED),
        ("branches_and_merges", BRANCHES_AND_MERGES),
        ("octopus_branch_and_merge", OCTOPUS_BRANCH_AND_MERGE),
        ("reserved_column", RESERVED_COLUMN),
        ("ancestors", ANCESTORS),
        ("split_parents", SPLIT_PARENTS),
        ("terminations", TERMINATIONS),
        ("long_messages", LONG_MESSAGES),
        ("orders1", ORDERS1),
        ("orders2", ORDERS2),
    ];
    let option_matrix = [
        opts(0, false),
        opts(1, false),
        opts(2, false),
        opts(3, false),
        opts(0, true),
        opts(1, true),
        opts(2, true),
    ];

    let mut named_cases: Vec<Value> = Vec::new();
    for (name, fixture) in named.iter() {
        for options in option_matrix.iter() {
            let case_name = format!(
                "{}-h{}{}",
                name,
                options.min_row_height,
                if options.stagger_consecutive_disconnected_nodes { "-stagger" } else { "" }
            );
            let steps = fixture_steps(fixture, None);
            named_cases.push(run_case(&case_name, *options, &steps));
        }
    }

    // Variants from the crate's unit tests.
    let basic_disconnected_missing_c = TestFixture {
        missing: &["C"],
        ..BASIC_DISCONNECTED
    };
    for options in [opts(1, false), opts(2, false)] {
        let case_name = format!("basic_disconnected_missing_c-h{}", options.min_row_height);
        let steps = fixture_steps(&basic_disconnected_missing_c, None);
        named_cases.push(run_case(&case_name, options, &steps));
    }
    let basic_disconnected_msgs1 = TestFixture {
        messages: &[("C", "\n\n"), ("B", "\n")],
        ..BASIC_DISCONNECTED
    };
    named_cases.push(run_case(
        "basic_disconnected_blank_messages-h1",
        opts(1, false),
        &fixture_steps(&basic_disconnected_msgs1, None),
    ));
    let basic_disconnected_msgs2 = TestFixture {
        messages: &[("C", "line 1\nline 2\n")],
        ..BASIC_DISCONNECTED
    };
    named_cases.push(run_case(
        "basic_disconnected_two_line_message-h1",
        opts(1, false),
        &fixture_steps(&basic_disconnected_msgs2, None),
    ));
    for order in ["KJIHGFEDCBZA", "KJIHGZBCDEFA", "KFJEIDHCGZBA"] {
        let order_vec: Vec<&str> = order.matches(|_: char| true).collect();
        let steps = fixture_steps(&ORDERS1, Some(&order_vec));
        named_cases.push(run_case(&format!("orders1-{order}"), opts(2, false), &steps));
    }

    let named_json = serde_json::to_string_pretty(&Value::Array(named_cases)).unwrap();
    std::fs::write(format!("{out_dir}/named.json"), named_json).unwrap();

    // Random cases.
    let mut random_cases: Vec<Value> = Vec::new();
    for idx in 0..200u64 {
        let (options, steps) = random_case(idx);
        random_cases.push(run_case(&format!("random-{idx:04}"), options, &steps));
    }
    let random_json = serde_json::to_string_pretty(&Value::Array(random_cases)).unwrap();
    std::fs::write(format!("{out_dir}/random.json"), random_json).unwrap();

    eprintln!("wrote fixtures to {out_dir}");
}
